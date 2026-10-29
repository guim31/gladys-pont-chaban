// -----------------------------------------------------------------------------
// The device "Pont Chaban-Delmas": is the bridge closed now, the next closure
// (start, reopening, reason, type), the minutes until it, the closures within
// 7 days and the date of the schedule. Read in the dashboard and in scene
// conditions ("only continue if the bridge is open"). Every feature shares
// its type with another one: Gladys shows the generic label of the type
// instead of the feature name when a feature is alone of its type.
// -----------------------------------------------------------------------------

import { closureToday, current, nextClosure, withinWeek } from './closures.js';
import { NAMES, REASON_TEXT, STATE_TEXT } from './i18n.js';
import { MINUTE, formatDateTime } from './time.js';

const TEXT = { category: 'text', type: 'text', min: 0, max: 0 };
const BINARY = { category: 'input', type: 'binary', min: 0, max: 1 };
export const MAX_MINUTES = 527_040; // 366 days

/** The bridges of the integration (one device each). Keys are forever. */
export const BRIDGES = [{ key: 'chaban-delmas', source: 'Bordeaux Métropole' }];

// Feature keys are forever (Gladys keys history and scenes on them).
export const FEATURES = [
  { key: 'closed_now', ...BINARY },
  { key: 'closure_today', ...BINARY },
  { key: 'next_start', ...TEXT },
  { key: 'next_end', ...TEXT },
  { key: 'next_reason', ...TEXT },
  { key: 'next_type', ...TEXT },
  {
    key: 'next_countdown',
    category: 'duration',
    type: 'integer',
    unit: 'minutes',
    min: 0,
    max: MAX_MINUTES,
  },
  { key: 'closures_7_days', category: 'counter-sensor', type: 'integer', min: 0, max: 100 },
  { key: 'data_updated', ...TEXT },
];

export function deviceIds(gladys, bridgeKey = BRIDGES[0].key) {
  return gladys.externalIds('bridge', bridgeKey);
}

export function buildDevices(gladys, config) {
  const names = NAMES[config.language];
  return BRIDGES.map((bridge) => {
    const ids = deviceIds(gladys, bridge.key);
    return {
      name: names.device,
      external_id: ids.device,
      should_poll: false,
      params: [{ name: 'source', value: bridge.source }],
      features: FEATURES.map(({ key, category, type, unit, min, max }) => ({
        name: names[key],
        external_id: ids.feature(key),
        category,
        type,
        ...(unit ? { unit } : {}),
        min,
        max,
        read_only: true,
        has_feedback: false,
      })),
    };
  });
}

/**
 * Minutes until a closure: 0 while it runs, to the minute in the last two
 * hours, by quarters of an hour before (a state a minute for days would only
 * fill the history). MAX_MINUTES when none is announced, never 0.
 */
export function countdownMinutes(left) {
  const minutes = Math.max(0, Math.ceil(left / MINUTE));
  return Math.min(MAX_MINUTES, minutes <= 120 ? minutes : minutes - (minutes % 15));
}

/** "MARATHON DE BORDEAUX", "passage de BALMORAL", "maintenance". */
export function why(closure, language) {
  return REASON_TEXT[language][closure.reason](closure.label);
}

/**
 * The states of the device at an instant. Nothing is published before the
 * first reading: a value the integration does not know is left out.
 * @param {object} gladys the SDK client
 * @param {object} config a normalized configuration
 * @param {{ closures: object[]|null, modified: number|null }} data
 * @param {{ now: number, timeZone: string }} at
 */
export function buildStates(gladys, config, { closures, modified }, { now, timeZone }) {
  if (!closures) {
    return [];
  }
  const language = config.language;
  const text = STATE_TEXT[language];
  const ids = deviceIds(gladys);
  const states = [];
  const number = (key, value) =>
    states.push({ device_feature_external_id: ids.feature(key), state: value });
  const string = (key, value) =>
    states.push({ device_feature_external_id: ids.feature(key), text: String(value || text.none) });

  const next = nextClosure(closures, now);
  number('closed_now', current(closures, now) ? 1 : 0);
  number('closure_today', closureToday(closures, now, timeZone) ? 1 : 0);
  string('next_start', next && formatDateTime(next.start, language, timeZone));
  string('next_end', next && formatDateTime(next.end, language, timeZone));
  string('next_reason', next && next.label);
  string('next_type', next && (next.total ? text.total : text.partial));
  number('next_countdown', next ? countdownMinutes(next.start - now) : MAX_MINUTES);
  number('closures_7_days', Math.min(100, withinWeek(closures, now).length));
  if (modified) {
    string('data_updated', formatDateTime(modified, language, timeZone));
  }
  return states;
}
