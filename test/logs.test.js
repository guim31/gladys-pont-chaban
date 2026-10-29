// -----------------------------------------------------------------------------
// The integration runs on its own clock (Gladys never polls the device),
// and its logs stay quiet: nothing at info on a normal day, closures
// included; a repeated failure logged once, its end logged once.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, fakePortal } from './helpers/world.js';

/** Captures the lines of the SDK logger (console.log / console.error). */
function captureLogs(t) {
  const previous = process.env.LOG_LEVEL;
  delete process.env.LOG_LEVEL; // the default level: info
  t.after(() => {
    if (previous !== undefined) {
      process.env.LOG_LEVEL = previous;
    }
  });
  const lines = [];
  const keep = (prefix, ...args) => lines.push([prefix, ...args].map(String).join(' '));
  t.mock.method(console, 'log', keep);
  t.mock.method(console, 'error', keep);
  return {
    lines,
    at: (level) => lines.filter((line) => line.includes(`[${level}]`)),
    clear: () => lines.splice(0),
  };
}

const flush = async () => {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

test('the device is never polled: its own timer reads and fires the triggers', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-05-13T01:58:10Z') });
  const world = await createWorld({ timers: true });
  t.after(() => world.app.stop());
  const [device] = world.gladys.fake.discoveredDevices;
  assert.equal(device.should_poll, false, 'Gladys 5.2.0 polls only should_poll devices');
  assert.equal(device.poll_frequency, undefined);
  for (let minute = 0; minute < 8; minute += 1) {
    t.mock.timers.tick(60_000);
    await flush();
  }
  // 04:04 in Bordeaux: AMBITION closes the bridge.
  assert.deepEqual(
    world.gladys.fake.sceneEvents.map((event) => event.key),
    ['closure_started'],
  );
  assert.equal(world.state('closed_now'), 1);
});

test('a busy day writes nothing at info: ticks, readings, triggers', async (t) => {
  const logs = captureLogs(t);
  const world = await createWorld({ at: '2026-05-15T22:00:00Z' });
  t.after(() => world.app.stop());
  logs.clear();
  await world.runUntil('2026-05-16T22:00:00Z');
  // AIDALUNA twice, the evening alerts of 16 May.
  assert.ok(world.gladys.fake.sceneEvents.length >= 10);
  assert.deepEqual(logs.lines, []);
});

test('repeated failures are logged once, their end once', async (t) => {
  const logs = captureLogs(t);
  const portal = fakePortal();
  const world = await createWorld({ portal, at: '2026-05-13T00:00:00Z' });
  t.after(() => world.app.stop());
  // The portal refuses us, and Gladys refuses states, statuses and scene
  // events, for hours.
  portal.status = 503;
  const down = async () => {
    throw new Error('Gladys is restarting');
  };
  const mocks = ['publishChangedStates', 'setConnectionStatus', 'publishSceneEvent'].map((name) =>
    t.mock.method(world.gladys, name, down),
  );
  await world.runUntil('2026-05-13T04:00:00Z');
  const warnings = logs.at('WARN');
  assert.equal(warnings.length, 4, warnings.join('\n'));
  for (const pattern of [
    /Could not read Bordeaux Métropole open data: Bordeaux Métropole open data answered HTTP 503/,
    /Could not report the status/,
    /Could not publish the states/,
    /Could not fire closure_started/,
  ]) {
    assert.equal(warnings.filter((line) => pattern.test(line)).length, 1, String(pattern));
  }
  assert.deepEqual(logs.at('INFO'), []);

  // Everything is back: one line per recovery, then silence.
  for (const mock of mocks) {
    mock.mock.restore();
  }
  portal.status = 200;
  logs.clear();
  // The next event is "closure tomorrow" at 08:00 in Bordeaux.
  await world.runUntil('2026-05-13T06:30:00Z');
  const recoveries = logs.at('INFO');
  for (const pattern of [
    /open data read again/,
    /States published again/,
    /Scene triggers fired again/,
  ]) {
    assert.equal(recoveries.filter((line) => pattern.test(line)).length, 1, String(pattern));
  }
  assert.equal(world.gladys.fake.connectionStatus.connected, true);
  logs.clear();
  await world.runUntil('2026-05-13T10:00:00Z');
  assert.deepEqual(logs.lines, []);
});
