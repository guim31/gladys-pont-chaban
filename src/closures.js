// -----------------------------------------------------------------------------
// Questions asked of the list of closures at an instant: is the bridge closed
// now, which closure is next, how many in the coming days, which ones start
// on a given local day. The list is sorted by start (src/opendata.js).
// -----------------------------------------------------------------------------

import { DAY, localDate } from './time.js';

export const WEEK = 7 * DAY;

/** The closures not over yet at `now`: the running one first, if any. */
export function upcoming(closures, now) {
  return (closures ?? []).filter((closure) => closure.end > now);
}

/** The closure running at `now`, or null. */
export function current(closures, now) {
  return (closures ?? []).find((closure) => closure.start <= now && now < closure.end) ?? null;
}

/** The running closure, otherwise the next one, or null. */
export function nextClosure(closures, now) {
  return upcoming(closures, now)[0] ?? null;
}

/** The closures not over yet that start within 7 days (the running one included). */
export function withinWeek(closures, now) {
  return upcoming(closures, now).filter((closure) => closure.start < now + WEEK);
}

/** The closures starting on a local date ('YYYY-MM-DD'). */
export function startingOn(closures, date, timeZone) {
  return (closures ?? []).filter((closure) => localDate(closure.start, timeZone) === date);
}

/** Is a closure still due today (running, or starting later today)? */
export function closureToday(closures, now, timeZone) {
  const today = localDate(now, timeZone);
  return upcoming(closures, now).some(
    (closure) => closure.start <= now || localDate(closure.start, timeZone) === today,
  );
}
