// -----------------------------------------------------------------------------
// Dashboard widget "Bridge closures" (key "upcoming_closures"): open or closed
// now, the countdown to the next closure (or the reopening time), and the next
// closures. Produced from the cached schedule, not from the device: it works
// before the device is added. Localized from the language of the person
// looking at it; titled with the name the device has in Gladys.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { current, upcoming } from './closures.js';
import { LANGUAGES } from './config.js';
import { NAMES, STATE_TEXT, WIDGET_TEXT } from './i18n.js';
import { deviceIds, why } from './device.js';
import { WIDGET_KEY } from './service.js';
import { DAY, HOUR, MINUTE, formatDay, formatTime, localDate } from './time.js';

export const ROW_COUNTS = ['3', '5', '8'];
export const DEFAULT_ROWS = '5';

export function countdown(ms, text) {
  const left = Math.max(0, ms);
  if (left >= DAY) {
    return text.daysHours(Math.floor(left / DAY), Math.floor((left % DAY) / HOUR));
  }
  return text.hoursMinutes(Math.floor(left / HOUR), Math.ceil((left % HOUR) / MINUTE) % 60);
}

/** Cut at `max` characters, with an ellipsis. */
export function clip(text, max) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** "sam. 8 nov. · 07:00 – 15:00", "+1" when it reopens the next day. */
export function window(closure, language, timeZone) {
  const nextDay = localDate(closure.end, timeZone) !== localDate(closure.start, timeZone);
  return `${formatDay(closure.start, language, timeZone)} · ${formatTime(closure.start, language, timeZone)} – ${formatTime(closure.end, language, timeZone)}${nextDay ? ' (+1)' : ''}`;
}

/** The name of the device in Gladys (the user may have renamed it). */
function title(service, lang) {
  const id = deviceIds(service.gladys).device;
  const device = (service.gladys.devices ?? []).find((entry) => entry.external_id === id);
  return device?.name || NAMES[lang].device;
}

/**
 * The widget content.
 * @param {object} service the BridgeService
 * @param {{ settings?: object, language?: string }} request
 */
export function buildContent(service, { settings = {}, language } = {}) {
  const lang = LANGUAGES.includes(language) ? language : service.config.language;
  const text = WIDGET_TEXT[lang];
  const rows = Number(ROW_COUNTS.includes(String(settings.rows)) ? settings.rows : DEFAULT_ROWS);
  const showStatus = settings.show_status !== false;
  const now = service.now();
  const components = [{ type: 'text', variant: 'heading', text: clip(title(service, lang), 60) }];
  const closures = service.closures();
  if (!closures) {
    components.push({ type: 'text', variant: 'body', text: text.noData });
    return { ttl_seconds: 300, components };
  }
  const running = current(closures, now);
  const list = upcoming(closures, now);
  if (showStatus) {
    components.push({
      type: 'value',
      label: text.traffic,
      value: running ? text.closed : text.open,
      icon: running ? 'x-circle' : 'check-circle',
      color: running ? WIDGET_COLORS.DANGER : WIDGET_COLORS.SUCCESS,
    });
    if (running) {
      components.push({
        type: 'value',
        label: text.reopensAt,
        value: formatTime(running.end, lang, service.timeZone),
        icon: 'clock',
      });
    } else if (list[0]) {
      components.push({
        type: 'value',
        label: text.nextIn,
        value: countdown(list[0].start - now, text),
        icon: 'clock',
        color: list[0].start - now < HOUR ? WIDGET_COLORS.WARNING : WIDGET_COLORS.NEUTRAL,
      });
    }
  }
  if (list.length === 0) {
    components.push({ type: 'text', variant: 'body', text: text.none });
    return { ttl_seconds: 900, components };
  }
  const states = STATE_TEXT[lang];
  components.push({
    type: 'card-list',
    display: 'list',
    items: list.slice(0, rows).map((closure) => ({
      title: clip(window(closure, lang, service.timeZone), 60),
      subtitle: clip(why(closure, lang), 60),
      badge: {
        text: closure.total ? states.total : states.partial,
        color: closure.total ? WIDGET_COLORS.DANGER : WIDGET_COLORS.WARNING,
      },
    })),
  });
  // The clock asks for a refresh when the bridge closes, reopens, or the
  // countdown changes.
  return { ttl_seconds: 300, components };
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    get: (service, request) => buildContent(service, request),
  },
};
