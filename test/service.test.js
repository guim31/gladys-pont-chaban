// -----------------------------------------------------------------------------
// The clock of the integration on the recorded schedule: device states as the
// bridge closes and reopens, scene triggers at the right minute and never
// twice, the cache in /data, failures of the portal and of Gladys.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRIGGERS } from '../src/service.js';
import { createMemoryStore, createWorld, fakePortal } from './helpers/world.js';

const keys = (world) => world.gladys.fake.sceneEvents.map((event) => event.key);

test('the states of the device, before and during a closure', async (t) => {
  // Tuesday 12 May 2026, 12:00 in Bordeaux.
  const world = await createWorld();
  t.after(() => world.app.stop());
  assert.deepEqual(world.state('closed_now'), 0);
  assert.deepEqual(world.state('closure_today'), 0);
  assert.deepEqual(world.state('next_start'), 'mer. 13 mai · 04:04');
  assert.deepEqual(world.state('next_end'), 'mer. 13 mai · 05:27');
  assert.deepEqual(world.state('next_reason'), 'AMBITION');
  assert.deepEqual(world.state('next_type'), 'Totale');
  assert.deepEqual(world.state('next_countdown'), 964);
  assert.deepEqual(world.state('closures_7_days'), 8);
  assert.deepEqual(world.state('data_updated'), 'ven. 23 oct. · 15:29');

  await world.runUntil('2026-05-13T02:04:00Z'); // 04:04 in Bordeaux
  assert.deepEqual(world.state('closed_now'), 1);
  assert.deepEqual(world.state('closure_today'), 1);
  assert.deepEqual(world.state('next_countdown'), 0);
  await world.runUntil('2026-05-13T03:27:00Z');
  assert.deepEqual(world.state('closed_now'), 0);
  assert.deepEqual(world.state('closure_today'), 1, "L'AUSTRAL at 16:49");
  assert.deepEqual(world.state('next_reason'), "L'AUSTRAL");
  await world.runUntil('2026-05-13T15:57:00Z');
  assert.deepEqual(world.state('closure_today'), 0);
  // One reading an hour, two requests each.
  assert.equal(world.portal.calls.length, 2 * 30);
});

test('closure tomorrow, starts and ends fire at their minute, once', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await world.runUntil('2026-05-13T03:30:00Z');
  const events = world.gladys.fake.sceneEvents;
  const tomorrow = events.filter((event) => event.key === TRIGGERS.CLOSURE_TOMORROW);
  // 12 May, 12:00 is the start: 17:00 to 22:00 are still to come.
  assert.deepEqual(
    tomorrow.map((event) => event.data.hour),
    [17, 18, 19, 20, 21, 22],
  );
  const device = world.device().external_id;
  assert.deepEqual(tomorrow[3].data, {
    device,
    hour: 20,
    sentence:
      "Demain, mercredi 13 mai, le pont Chaban-Delmas ferme 2 fois : de 04:04 à 05:27 (passage de AMBITION) ; de 16:49 à 17:57 (passage de L'AUSTRAL).",
    count: 2,
    date: 'mercredi 13 mai',
    first_start: '04:04',
    first_end: '05:27',
    first_label: 'AMBITION',
    total: true,
  });
  const started = events.find((event) => event.key === TRIGGERS.CLOSURE_STARTED);
  assert.deepEqual(started.data, {
    device,
    sentence:
      "Le pont Chaban-Delmas est maintenant fermé à la circulation jusqu'à 05:27 (passage de AMBITION).",
    label: 'AMBITION',
    reason: 'boat',
    reason_text: 'passage de AMBITION',
    total: true,
    start: '04:04',
    end: '05:27',
    duration_minutes: 83,
  });
  assert.equal(keys(world).filter((key) => key === TRIGGERS.CLOSURE_ENDED).length, 1);
  // Fired at the minute of the closure, not before.
  assert.deepEqual(keys(world).slice(-2), [TRIGGERS.CLOSURE_STARTED, TRIGGERS.CLOSURE_ENDED]);
});

test('a night maintenance across the clock change: the trigger the evening before, the end at 05:00', async (t) => {
  const portal = fakePortal();
  portal.records = [
    {
      bateau: 'MAINTENANCE',
      date_passage: '2026-10-24',
      fermeture_a_la_circulation: '23:00',
      re_ouverture_a_la_circulation: '05:00',
      type_de_fermeture: 'Totale',
      fermeture_totale: 'oui',
    },
  ];
  const world = await createWorld({
    portal,
    at: '2026-10-23T10:00:00Z',
    config: { language: 'en' },
  });
  t.after(() => world.app.stop());
  await world.runUntil('2026-10-23T18:00:00Z'); // 20:00 summer time
  const [tomorrow] = world.gladys.fake.sceneEvents.filter((event) => event.data.hour === 20);
  assert.equal(
    tomorrow.data.sentence,
    'Tomorrow, Saturday, October 24, the Chaban-Delmas bridge closes once: from 23:00 to 05:00 (Sunday, October 25) (maintenance).',
  );
  await world.runUntil('2026-10-25T03:59:00Z');
  assert.deepEqual(world.state('closed_now'), 1);
  assert.equal(keys(world).at(-1), TRIGGERS.CLOSURE_STARTED);
  await world.runUntil('2026-10-25T04:00:00Z'); // 05:00 winter time
  assert.equal(keys(world).at(-1), TRIGGERS.CLOSURE_ENDED);
  assert.deepEqual(world.state('closed_now'), 0);
  assert.deepEqual(world.state('next_start'), 'None announced');
});

test('after a restart, nothing fires twice and the last 10 minutes are caught up', async (t) => {
  const store = createMemoryStore();
  const first = await createWorld({ store, at: '2026-05-13T01:50:00Z' });
  await first.runUntil('2026-05-13T01:58:00Z');
  await first.app.stop();
  // Stopped at 03:58 in Bordeaux, back at 04:10: AMBITION closed at 04:04.
  const second = await createWorld({ store, at: '2026-05-13T02:10:00Z' });
  t.after(() => second.app.stop());
  assert.deepEqual(keys(second), [TRIGGERS.CLOSURE_STARTED]);
  // The cache of 20 minutes ago is used: no reading before the hour is up.
  assert.equal(second.portal.calls.length, 0);
  // Down for an hour: the end of AMBITION (05:27) is not announced at 06:30.
  await second.app.stop();
  const third = await createWorld({ store, at: '2026-05-13T04:30:00Z' });
  t.after(() => third.app.stop());
  assert.deepEqual(keys(third), []);
});

test('an event Gladys refuses is sent again at the next minute', async (t) => {
  const world = await createWorld({ at: '2026-05-13T02:00:00Z' });
  t.after(() => world.app.stop());
  let refuse = true;
  const publish = world.gladys.publishSceneEvent.bind(world.gladys);
  t.mock.method(world.gladys, 'publishSceneEvent', async (...args) => {
    if (refuse) {
      throw new Error('Gladys is restarting');
    }
    return publish(...args);
  });
  await world.runUntil('2026-05-13T02:05:00Z');
  assert.deepEqual(keys(world), []);
  refuse = false;
  await world.runUntil('2026-05-13T02:06:00Z');
  assert.deepEqual(keys(world), [TRIGGERS.CLOSURE_STARTED]);
  await world.runUntil('2026-05-13T02:10:00Z');
  assert.deepEqual(keys(world), [TRIGGERS.CLOSURE_STARTED]);
});

test('the portal down: the cached schedule is used, the status says why, in four languages', async (t) => {
  const store = createMemoryStore();
  const ok = await createWorld({ store });
  await ok.app.stop();
  const portal = fakePortal({ fail: true });
  const world = await createWorld({ store, portal, at: '2026-05-12T12:00:00Z' });
  t.after(() => world.app.stop());
  // The cache is an hour old at most... here two: a reading is tried, and fails.
  assert.equal(world.gladys.fake.connectionStatus.connected, false);
  assert.deepEqual(Object.keys(world.gladys.fake.connectionStatus.message).sort(), [
    'de',
    'en',
    'es',
    'fr',
  ]);
  assert.deepEqual(world.state('next_reason'), 'AMBITION');
  // Retried every 10 minutes, not every minute.
  portal.calls.length = 0;
  await world.runUntil('2026-05-12T12:30:00Z');
  assert.equal(portal.calls.length, 3);
  portal.fail = false;
  await world.runUntil('2026-05-12T12:41:00Z');
  assert.equal(world.gladys.fake.connectionStatus.connected, true);
});

test('before any reading, nothing is published but the device', async (t) => {
  const world = await createWorld({ portal: fakePortal({ status: 429 }) });
  t.after(() => world.app.stop());
  assert.equal(world.gladys.fake.discoveredDevices.length, 1);
  assert.equal(world.state('closed_now'), undefined);
  assert.match(world.gladys.fake.connectionStatus.message.fr, /refuse trop de requêtes/);
});

test('a device added later gets every state again', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const before = world.gladys.fake.states.length;
  await world.gladys.fake.deviceCreated(world.device());
  assert.equal(world.gladys.fake.states.length - before, 9);
});

test('the language setting renames the device and its texts', async (t) => {
  const world = await createWorld({ config: { language: 'de' } });
  t.after(() => world.app.stop());
  assert.equal(world.device().name, 'Chaban-Delmas-Brücke');
  assert.deepEqual(world.state('next_start'), 'Mi., 13. Mai · 04:04');
  await world.gladys.fake.configUpdated({ language: 'es' });
  assert.equal(world.gladys.fake.discoveredDevices.at(-1).name, 'Puente Chaban-Delmas');
  assert.deepEqual(world.state('next_type'), 'Total');
});
