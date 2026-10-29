// -----------------------------------------------------------------------------
// The heart of the integration: the closures read from Bordeaux Métropole and
// kept in a cache in /data, and the clock that turns them into device states
// and scene events.
//
// The clock ticks every minute (Gladys never polls the device, should_poll is
// false):
// - it reads the dataset every hour (every 10 minutes after a failure): two
//   requests, far under the 50,000 a day the portal allows;
// - it fires "closure starts" and "closure ends" at the times of the
//   schedule, and "closure tomorrow" the day before, at each hour the scene
//   filter offers. Fired events are remembered in /data: never twice, even
//   after a restart; after a restart, those of the last 10 minutes still go;
// - it publishes the states that changed (the bridge closes and reopens on
//   the clock, not on a reading), and every state twice a day (Gladys flags a
//   value older than 48 hours as "no recent value").
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { current, nextClosure, startingOn } from './closures.js';
import { buildDevices, buildStates, deviceIds, why } from './device.js';
import { createFailureLog } from './failures.js';
import { BRIDGE_IN_SENTENCE, PROBLEM_TEXT, SENTENCES, inEveryLanguage } from './i18n.js';
import { parseClosures } from './opendata.js';
import { closureWords } from './scenes.js';
import {
  HOUR,
  MINUTE,
  formatDay,
  localDate,
  nextDate,
  processTimeZone,
  zonedInstant,
} from './time.js';

const logger = createLogger({ name: 'chaban' });

export const WIDGET_KEY = 'upcoming_closures';

// Trigger keys are forever: scenes store them.
export const TRIGGERS = {
  CLOSURE_TOMORROW: 'closure_tomorrow',
  CLOSURE_STARTED: 'closure_started',
  CLOSURE_ENDED: 'closure_ended',
};

// The hours "closure tomorrow" can fire at, the day before (local time).
export const EVENING_HOURS = [8, 12, 17, 18, 19, 20, 21, 22];

const READ_EVERY = HOUR;
const RETRY_AFTER = 10 * MINUTE;
const HEARTBEAT = 12 * HOUR;
// After a restart, the triggers of the last minutes are still fired.
const CATCH_UP = 10 * MINUTE;
const FORGET_AFTER = 3 * 24 * HOUR;
const SAVE_EVERY = 5 * MINUTE;

const CACHE_FILE = 'cache.json';
const TRIGGERS_FILE = 'triggers.json';

export class BridgeService {
  /**
   * @param {object} options
   * @param {object} options.gladys the SDK client
   * @param {object} options.store JSON files in /data (src/store.js)
   * @param {object} options.api the open data client (src/opendata.js)
   * @param {Function} [options.now] the clock (tests)
   * @param {string} [options.timeZone] Gladys' time zone (default: TZ)
   * @param {boolean} [options.timers] false in the tests: they call tick()
   */
  constructor({ gladys, store, api, now = Date.now, timeZone, timers = true }) {
    this.gladys = gladys;
    this.store = store;
    this.api = api;
    this.now = now;
    this.timeZone = timeZone ?? processTimeZone();
    this.timers = timers;
    this.config = null;
    this.records = null;
    this.parsed = null;
    this.modified = null;
    this.fetchedAt = 0;
    this.apiError = null;
    this.rateLimited = false;
    this.retryAt = 0;
    // Events already fired: key → the instant they were for.
    this.fired = {};
    this.lastCheck = 0;
    this.lastForce = 0;
    this.savedAt = 0;
    // undefined: nothing reported yet (null is "no problem").
    this.statusKey = undefined;
    this.widgetKey = null;
    this.timer = null;
    this.queue = Promise.resolve();
    this.failures = createFailureLog(logger);
  }

  // One operation at a time: a tick never interleaves with a reconfiguration.
  serial(fn) {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => {});
    return run;
  }

  start(config) {
    return this.serial(async () => {
      this.config = config;
      this.loadCache();
      const saved = this.store.load(TRIGGERS_FILE);
      const now = this.now();
      this.fired = saved?.fired ?? {};
      // A fresh install fires nothing for what happened before it.
      this.lastCheck = saved?.lastCheck ? Math.max(saved.lastCheck, now - CATCH_UP) : now;
      // The clock runs whatever happens below: a failure at start-up must not
      // stop the readings and the triggers until the next restart.
      this.schedule();
      // The device first: a portal that hangs must not keep it out of Discovery.
      await this.publishDevices();
      await this.refresh();
      await this.publishStates({ force: true });
      await this.updateStatus();
      this.refreshWidget();
      await this.fireTriggers();
    });
  }

  /** The configuration changed (language): names and texts follow. */
  reconfigure(config) {
    return this.serial(async () => {
      this.config = config;
      await this.publishDevices();
      await this.publishStates({ force: true });
      await this.updateStatus({ force: true });
      this.refreshWidget();
    });
  }

  /** Gladys came back (restart): it may have lost what was sent meanwhile. */
  resync(config) {
    return this.reconfigure(config);
  }

  /** The user added the device: its states were dropped until now. */
  deviceCreated() {
    return this.serial(async () => {
      await this.publishStates({ force: true });
      this.refreshWidget();
    });
  }

  /** "Check" on the Configuration screen: the dataset read again now. */
  check() {
    return this.serial(async () => {
      await this.refresh({ force: true });
      await this.publishStates();
      await this.updateStatus();
      this.refreshWidget();
    });
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = null;
    return this.queue;
  }

  schedule() {
    if (!this.timers) {
      return;
    }
    clearTimeout(this.timer);
    // Just after the next minute: a closure at 07:00 is seen at 07:00.
    const delay = MINUTE - (this.now() % MINUTE) + 500;
    this.timer = setTimeout(() => {
      this.tick()
        .then(() => this.failures.succeeded('tick', 'The clock works again'))
        .catch((err) => this.failures.failed('tick', 'Clock tick failed', err))
        .finally(() => this.schedule());
    }, delay);
    this.timer.unref?.();
  }

  /** One step of the clock. */
  tick() {
    return this.serial(async () => {
      if (await this.refresh()) {
        await this.updateStatus();
      }
      await this.publishStates({ force: this.now() - this.lastForce >= HEARTBEAT });
      await this.fireTriggers();
      if (this.widgetSignature() !== this.widgetKey) {
        this.refreshWidget();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // The dataset and its cache
  // ---------------------------------------------------------------------------

  /** Every closure known, sorted; null before the first reading. */
  closures() {
    if (!this.records) {
      return null;
    }
    this.parsed ??= parseClosures(this.records);
    return this.parsed;
  }

  setRecords(records) {
    this.records = records;
    this.parsed = null;
  }

  loadCache() {
    const cache = this.store.load(CACHE_FILE);
    if (cache?.version !== 1 || !Array.isArray(cache.records)) {
      return;
    }
    this.setRecords(cache.records);
    this.fetchedAt = cache.fetched_at ?? 0;
    this.modified = cache.modified ?? null;
  }

  saveCache() {
    this.store.save(CACHE_FILE, {
      version: 1,
      fetched_at: this.fetchedAt,
      modified: this.modified,
      records: this.records,
    });
  }

  /**
   * Reads the dataset when due (always with `force`).
   * @returns {Promise<boolean>} true when something was read or failed: the
   *   connection status may have changed
   */
  async refresh({ force = false } = {}) {
    const now = this.now();
    if (!force && (now < this.retryAt || now - this.fetchedAt < READ_EVERY)) {
      return false;
    }
    try {
      const records = await this.api.records(now);
      this.setRecords(records);
      // The update date is cosmetic: its failure never discards the closures.
      this.modified =
        (await this.api.modified().catch((err) => {
          logger.debug(`Could not read the update date: ${err.message}`);
          return null;
        })) ?? this.modified;
      this.fetchedAt = now;
      this.apiError = null;
      this.rateLimited = false;
      this.retryAt = 0;
      this.saveCache();
      this.failures.succeeded('api', 'Bordeaux Métropole open data read again');
      logger.debug(`Read ${records.length} closures from Bordeaux Métropole`);
    } catch (err) {
      this.retryAt = now + RETRY_AFTER;
      this.apiError = err.message;
      this.rateLimited = err.status === 429;
      this.failures.failed('api', `Could not read Bordeaux Métropole open data: ${err.message}`);
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Scene triggers
  // ---------------------------------------------------------------------------

  /** The variables of "closure starts" / "closure ends". */
  closureData(key, closure) {
    const language = this.config.language;
    const words = closureWords(closure, language, this.timeZone);
    const sentences = SENTENCES[language];
    return {
      sentence:
        key === TRIGGERS.CLOSURE_STARTED ? sentences.started(words) : sentences.ended(words),
      label: closure.label,
      reason: closure.reason,
      reason_text: why(closure, language),
      total: closure.total,
      start: words.start,
      end: words.end,
      duration_minutes: Math.round((closure.end - closure.start) / MINUTE),
    };
  }

  /** The variables of "closure tomorrow". */
  tomorrowData(hour, date, list) {
    const language = this.config.language;
    const words = list.map((closure) => closureWords(closure, language, this.timeZone));
    const day = formatDay(list[0].start, language, this.timeZone, 'long');
    return {
      hour,
      sentence: SENTENCES[language].tomorrow(BRIDGE_IN_SENTENCE[language], day, words),
      count: list.length,
      date: day,
      first_start: words[0].start,
      first_end: words[0].end,
      first_label: list[0].label,
      total: list.some((closure) => closure.total),
    };
  }

  /** Every event due between the last check and now, in time order. */
  dueEvents(from, now) {
    const closures = this.closures() ?? [];
    const events = [];
    for (const closure of closures) {
      for (const [key, at] of [
        [TRIGGERS.CLOSURE_STARTED, closure.start],
        [TRIGGERS.CLOSURE_ENDED, closure.end],
      ]) {
        if (at > from && at <= now) {
          events.push({
            at,
            id: `${key}|${closure.id}`,
            key,
            data: () => this.closureData(key, closure),
          });
        }
      }
    }
    const dates = new Set([localDate(from, this.timeZone), localDate(now, this.timeZone)]);
    for (const date of dates) {
      for (const hour of EVENING_HOURS) {
        const at = zonedInstant(date, `${hour}:00`, this.timeZone);
        if (at === null || at <= from || at > now) {
          continue;
        }
        const list = startingOn(closures, nextDate(date), this.timeZone);
        if (list.length > 0) {
          events.push({
            at,
            id: `${TRIGGERS.CLOSURE_TOMORROW}|${date}|${hour}`,
            key: TRIGGERS.CLOSURE_TOMORROW,
            data: () => this.tomorrowData(hour, date, list),
          });
        }
      }
    }
    return events.sort((a, b) => a.at - b.at);
  }

  /**
   * Fires the events reached since the last check. A refused event is sent
   * again at the next tick (10 minutes at most), the others are not repeated.
   */
  async fireTriggers() {
    const now = this.now();
    // Nothing read yet: the interval stays open (10 minutes at most, below).
    if (!this.closures()) {
      return;
    }
    const from = Math.max(this.lastCheck, now - CATCH_UP);
    if (now <= from) {
      return; // the clock stepped back: this interval was already checked
    }
    this.lastCheck = now;
    let changed = false;
    const device = deviceIds(this.gladys).device;
    let failedAt = null;
    for (const event of this.dueEvents(from, now)) {
      if (this.fired[event.id] !== undefined) {
        continue;
      }
      if (await this.fireEvent(event.key, { device, ...event.data() })) {
        this.fired[event.id] = event.at;
        changed = true;
      } else {
        failedAt ??= event.at;
      }
    }
    if (failedAt !== null) {
      this.lastCheck = Math.max(failedAt - 1, now - CATCH_UP);
    }
    for (const [id, at] of Object.entries(this.fired)) {
      if (at < now - FORGET_AFTER) {
        delete this.fired[id];
        changed = true;
      }
    }
    // Saved when something fired, and every 5 minutes for the catch-up after
    // a restart (10 minutes): `fired` keeps an event from going twice.
    if (changed || now - this.savedAt >= SAVE_EVERY) {
      this.store.save(TRIGGERS_FILE, { lastCheck: this.lastCheck, fired: this.fired });
      this.savedAt = now;
    }
  }

  async fireEvent(key, data) {
    try {
      await this.gladys.publishSceneEvent(key, data);
      this.failures.succeeded('scene-event', 'Scene triggers fired again');
      return true;
    } catch (err) {
      this.failures.failed('scene-event', `Could not fire ${key}: ${err.message}`);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Gladys side
  // ---------------------------------------------------------------------------

  async publishDevices() {
    try {
      await this.gladys.publishDiscoveredDevices(buildDevices(this.gladys, this.config));
      this.failures.succeeded('device', 'Device published again');
    } catch (err) {
      this.failures.failed('device', `Could not publish the device: ${err.message}`);
    }
  }

  /**
   * Publishes the states that changed, or all of them (`force`). A failure is
   * logged: the next publication sends again what Gladys did not accept.
   */
  async publishStates({ force = false } = {}) {
    if (force) {
      this.gladys.forgetPublishedStates();
      this.lastForce = this.now();
    }
    const states = buildStates(
      this.gladys,
      this.config,
      { closures: this.closures(), modified: this.modified },
      { now: this.now(), timeZone: this.timeZone },
    );
    try {
      await this.gladys.publishChangedStates(states);
      this.failures.succeeded('states', 'States published again');
    } catch (err) {
      this.failures.failed('states', `Could not publish the states: ${err.message}`);
    }
  }

  /** The problem shown in the connection status, or null. */
  problem() {
    if (!this.apiError) {
      return null;
    }
    return this.rateLimited ? 'limited' : 'unreachable';
  }

  /** Reports the status when it changed (or always, with `force`). */
  async updateStatus({ force = false } = {}) {
    const problem = this.problem();
    if (!force && problem === this.statusKey) {
      return;
    }
    const message = problem ? inEveryLanguage(PROBLEM_TEXT, (text) => text[problem]()) : undefined;
    try {
      await this.gladys.setConnectionStatus(problem === null, message);
      this.statusKey = problem;
      this.failures.succeeded('status', 'Status reported again');
    } catch (err) {
      this.failures.failed('status', `Could not report the status: ${err.message}`);
    }
  }

  widgetSignature() {
    const now = this.now();
    const closures = this.closures() ?? [];
    const next = nextClosure(closures, now);
    const left = next ? next.start - now : 0;
    return [
      next?.id,
      Boolean(current(closures, now)),
      // The widget TTL refreshes the countdown; a nudge every hour, every
      // minute in the last hour.
      Math.floor(Math.max(0, left) / (left < HOUR ? MINUTE : HOUR)),
      this.fetchedAt,
      this.config?.language,
    ].join('|');
  }

  refreshWidget() {
    this.widgetKey = this.widgetSignature();
    try {
      // Fire-and-forget, rate-limited by the core: never awaited.
      Promise.resolve(this.gladys.requestWidgetRefresh(WIDGET_KEY)).catch(() => {});
    } catch {
      // Disconnected: the widget refetches on its own TTL.
    }
  }
}
