// -----------------------------------------------------------------------------
// Scene action (manifest `scene_actions`): the next closure in one sentence,
// ready to send in a message or to say aloud ({{<column>.<row>.sentence}}), in
// the language of the configuration (a scene action does not get the user's
// language), and a few values for conditions.
// -----------------------------------------------------------------------------

import { current, nextClosure } from './closures.js';
import { why } from './device.js';
import { BRIDGE_IN_SENTENCE, SENTENCES } from './i18n.js';
import { MINUTE, formatDateTime, formatDay, formatTime, localDate } from './time.js';

/**
 * The words of a closure for the sentences. The reopening day is named only
 * when it is not the day of `reference` (the start, or now when running).
 */
export function closureWords(closure, language, timeZone, reference = closure.start) {
  const endsOtherDay = localDate(closure.end, timeZone) !== localDate(reference, timeZone);
  return {
    bridge: BRIDGE_IN_SENTENCE[language],
    day: formatDay(closure.start, language, timeZone, 'long'),
    start: formatTime(closure.start, language, timeZone),
    end: formatTime(closure.end, language, timeZone),
    endDay: endsOtherDay ? formatDay(closure.end, language, timeZone, 'long') : '',
    why: why(closure, language),
    total: closure.total,
  };
}

/** The next closure (or the running one) in a sentence. */
export function nextSentence(service, language = service.config.language) {
  const sentences = SENTENCES[language];
  const closures = service.closures();
  if (!closures) {
    return sentences.noData;
  }
  const now = service.now();
  const running = current(closures, now);
  if (running) {
    return sentences.closedNow(closureWords(running, language, service.timeZone, now));
  }
  const next = nextClosure(closures, now);
  return next
    ? sentences.next(closureWords(next, language, service.timeZone))
    : sentences.none(BRIDGE_IN_SENTENCE[language]);
}

export const SCENE_ACTIONS = {
  read_next_closure: async (service) => {
    const language = service.config.language;
    const closures = service.closures() ?? [];
    const now = service.now();
    const next = nextClosure(closures, now);
    return {
      sentence: nextSentence(service),
      closed_now: Boolean(current(closures, now)),
      minutes_until: next ? Math.max(0, Math.ceil((next.start - now) / MINUTE)) : -1,
      start: next ? formatDateTime(next.start, language, service.timeZone) : '',
      end: next ? formatDateTime(next.end, language, service.timeZone) : '',
      reason: next ? next.label : '',
      total: next ? next.total : false,
    };
  },
};
