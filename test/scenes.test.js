// -----------------------------------------------------------------------------
// The scene action "Read the next closure", and the "Check" action report.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './helpers/world.js';

const read = async (world) => {
  const ack = await world.gladys.fake.sceneAction('read_next_closure', {});
  assert.equal(ack.success, true, ack.error);
  return ack.data.outputs;
};

test('the next closure in one sentence', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  assert.deepEqual(await read(world), {
    sentence:
      'Prochaine fermeture du pont Chaban-Delmas : mercredi 13 mai, de 04:04 à 05:27 (passage de AMBITION), fermeture totale.',
    closed_now: false,
    minutes_until: 964,
    start: 'mer. 13 mai · 04:04',
    end: 'mer. 13 mai · 05:27',
    reason: 'AMBITION',
    total: true,
  });
});

test('during a night closure, the sentence says until when', async (t) => {
  const world = await createWorld({ at: '2026-11-15T22:30:00Z', config: { language: 'en' } });
  t.after(() => world.app.stop());
  const outputs = await read(world);
  assert.equal(
    outputs.sentence,
    'The Chaban-Delmas bridge is closed to traffic until 05:00 (Monday, November 16) (maintenance), total closure.',
  );
  assert.equal(outputs.closed_now, true);
  assert.equal(outputs.minutes_until, 0);
});

test('nothing announced', async (t) => {
  const world = await createWorld({ at: '2027-01-10T10:00:00Z', config: { language: 'es' } });
  t.after(() => world.app.stop());
  const outputs = await read(world);
  assert.equal(outputs.sentence, 'No hay ningún cierre del puente Chaban-Delmas anunciado.');
  assert.equal(outputs.minutes_until, -1);
});

test('"Check" reads again and reports in four languages', async (t) => {
  const world = await createWorld({ at: '2026-10-29T10:00:00Z' });
  t.after(() => world.app.stop());
  const calls = world.portal.calls.length;
  const ack = await world.gladys.fake.action('check', {});
  assert.equal(ack.success, true, ack.error);
  assert.equal(world.portal.calls.length, calls + 2);
  assert.equal(
    ack.data.message.fr,
    [
      'Bordeaux Métropole : 3 fermetures à venir.',
      'Prochaine fermeture du pont Chaban-Delmas : dimanche 8 novembre, de 07:00 à 15:00 (MARATHON DE BORDEAUX), fermeture totale.',
      'Planning mis à jour le ven. 23 oct. · 15:29.',
      '',
      "Données lues à l'instant.",
    ].join('\n'),
  );
  assert.deepEqual(Object.keys(ack.data.message).sort(), ['de', 'en', 'es', 'fr']);
});
