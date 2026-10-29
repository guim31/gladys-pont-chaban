// -----------------------------------------------------------------------------
// Time zones. Bordeaux Métropole gives each closure as a calendar date and two
// wall-clock times ("23:00", "05:00") in Bordeaux, Europe/Paris: they are
// turned into instants here, explicitly in that zone, whatever the zone of
// Gladys. Displays use the zone of Gladys (TZ, injected by the supervisor).
//
// The Alpine image has no tzdata: Node's ICU carries its own zones, so every
// conversion goes through Intl.
// -----------------------------------------------------------------------------

export const SOURCE_TIME_ZONE = 'Europe/Paris';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/**
 * The time zone of Gladys: TZ, set by the supervisor. An unusable value falls
 * back to the process zone.
 */
export function processTimeZone(env = process.env.TZ) {
  if (env) {
    try {
      return new Intl.DateTimeFormat('en', { timeZone: env }).resolvedOptions().timeZone;
    } catch {
      // Not an IANA name (':/etc/localtime'…): fall through.
    }
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

const cache = new Map();

function formatter(key, make) {
  let value = cache.get(key);
  if (!value) {
    value = make();
    cache.set(key, value);
  }
  return value;
}

/** The wall clock of an instant in a zone, as a UTC timestamp ("as if UTC"). */
function wallClock(ms, timeZone) {
  const parts = formatter(
    `wall:${timeZone}`,
    () =>
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23',
      }),
  ).formatToParts(new Date(ms));
  const get = (type) => Number(parts.find((part) => part.type === type).value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
}

/**
 * The instant of a wall-clock date and time in a zone. On the night clocks go
 * back (25/10/2026), 02:30 happens twice: the first one (summer time) is
 * taken. On the night they go forward (28/03/2027), 02:30 does not exist: it
 * is read with the winter offset, which lands on 03:30 summer time.
 * @param {string} date 'YYYY-MM-DD'
 * @param {string} time 'HH:MM'
 * @returns {number|null} null for a malformed date or time
 */
export function zonedInstant(date, time, timeZone = SOURCE_TIME_ZONE) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? '').trim());
  const t = /^(\d{1,2})[:hH](\d{2})$/.exec(String(time ?? '').trim());
  if (!d || !t) {
    return null;
  }
  const [year, month, day] = d.slice(1).map(Number);
  const [hour, minute] = t.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null;
  }
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  if (new Date(wall).getUTCDate() !== day) {
    return null; // 31 April and the like
  }
  // The offsets on either side of the day: one of them is the right one.
  const offsets = [
    ...new Set([wall - 12 * HOUR, wall + 12 * HOUR].map((ms) => wallClock(ms, timeZone) - ms)),
  ];
  const candidates = offsets
    .map((offset) => wall - offset)
    .filter((ms) => wallClock(ms, timeZone) === wall)
    .sort((a, b) => a - b);
  return candidates[0] ?? wall - offsets[0];
}

/** The calendar date ('YYYY-MM-DD') of an instant in a time zone. */
export function localDate(ms, timeZone) {
  return formatter(
    `date:${timeZone}`,
    () =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
  ).format(new Date(ms));
}

/** The local hour (0-23) of an instant. */
export function localHour(ms, timeZone) {
  return new Date(wallClock(ms, timeZone)).getUTCHours();
}

/** The date after a 'YYYY-MM-DD' date. */
export function nextDate(date) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + DAY).toISOString().slice(0, 10);
}

/** "07:00" */
export function formatTime(ms, language, timeZone) {
  return formatter(
    `time:${language}:${timeZone}`,
    () =>
      new Intl.DateTimeFormat(language, {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }),
  ).format(new Date(ms));
}

/** "sam. 8 nov." ('short') or "samedi 8 novembre" ('long'). */
export function formatDay(ms, language, timeZone, style = 'short') {
  return formatter(
    `day:${style}:${language}:${timeZone}`,
    () =>
      new Intl.DateTimeFormat(language, {
        timeZone,
        weekday: style,
        day: 'numeric',
        month: style,
      }),
  ).format(new Date(ms));
}

/** "sam. 8 nov. · 07:00" */
export function formatDateTime(ms, language, timeZone) {
  return `${formatDay(ms, language, timeZone)} · ${formatTime(ms, language, timeZone)}`;
}
