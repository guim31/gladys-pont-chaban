// -----------------------------------------------------------------------------
// A running integration against the SDK's fake Gladys, with a clock the test
// moves, the open data served from the answers recorded on 2026-10-29
// (test/fixtures/opendata) through the real client, and /data kept in memory.
// No network.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { createOpenData } from '../../src/opendata.js';

/** A recorded answer of the open data portal. */
export function fixture(name) {
  return JSON.parse(
    readFileSync(new URL(`../fixtures/opendata/${name}.json`, import.meta.url), 'utf8'),
  );
}

/**
 * A fetch serving the recorded answers, counting the calls. The test edits
 * `api.records` (raw records) to make things happen; `fail` makes every
 * request fail like a network error, `status` answers that HTTP status.
 */
export function fakePortal({ fail = false, status = 200 } = {}) {
  const portal = {
    calls: [],
    records: fixture('records-2026-10-29').results,
    dataset: fixture('dataset-2026-10-29'),
    fail,
    status,
    fetch: async (url) => {
      const { pathname, searchParams } = new URL(url);
      portal.calls.push(`${pathname}?${searchParams}`);
      if (portal.fail) {
        const err = new TypeError('fetch failed');
        err.cause = { code: 'ENOTFOUND' };
        throw err;
      }
      const body = pathname.endsWith('/records')
        ? { total_count: portal.records.length, results: structuredClone(portal.records) }
        : structuredClone(portal.dataset);
      return {
        ok: portal.status === 200,
        status: portal.status,
        json: async () => (portal.status === 200 ? body : { error_code: 'TooManyRequests' }),
      };
    },
  };
  return portal;
}

export function createMemoryStore(files = {}) {
  const content = new Map(Object.entries(files));
  return {
    files: content,
    load: (name) => (content.has(name) ? structuredClone(content.get(name)) : null),
    save: (name, value) => content.set(name, structuredClone(value)),
  };
}

/** A clock the test sets and moves. */
export function createClock(iso) {
  const clock = {
    ms: Date.parse(iso),
    now: () => clock.ms,
    advance: (ms) => {
      clock.ms += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] the configuration saved in Gladys
 * @param {string} [options.at] the instant of the start (ISO)
 * @param {string} [options.timeZone] Gladys' time zone
 * @param {object} [options.portal] fakePortal()
 * @param {object} [options.store] createMemoryStore()
 * @param {boolean} [options.connect] false: handlers registered, not started
 * @param {boolean} [options.timers] true: the real clock of the service runs,
 *   on Date.now and setTimeout (to mock with t.mock.timers)
 */
export async function createWorld({
  config = {},
  at = '2026-05-12T10:00:00Z',
  timeZone = 'Europe/Paris',
  portal = fakePortal(),
  store = createMemoryStore(),
  connect = true,
  timers = false,
} = {}) {
  const clock = createClock(at);
  const now = timers ? () => Date.now() : clock.now;
  const gladys = createFakeGladys({ config });
  const app = registerHandlers(gladys, {
    store,
    api: createOpenData({ fetch: portal.fetch, base: 'https://example.invalid/api' }),
    now,
    timeZone,
    timers,
  });
  if (connect) {
    await gladys.connect();
  }
  const { service } = app;
  return {
    gladys,
    app,
    service,
    clock,
    portal,
    store,
    device() {
      return gladys.fake.discoveredDevices[0];
    },
    /** The last value Gladys received for a feature key. */
    state(key) {
      return gladys.fake.lastState(`${this.device().external_id}:${key}`);
    },
    /** Moves the clock minute by minute up to an instant, ticking each minute. */
    async runUntil(iso) {
      const target = Date.parse(iso);
      while (clock.ms < target) {
        clock.advance(Math.min(60_000, target - clock.ms));
        await service.tick();
      }
    },
  };
}
