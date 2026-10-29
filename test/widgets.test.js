// -----------------------------------------------------------------------------
// The widget "Bridge closures": valid for the core, open or closed, its
// settings, the name of the device in Gladys.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { WIDGET_KEY } from '../src/service.js';
import { countdown } from '../src/widgets.js';
import { WIDGET_TEXT } from '../src/i18n.js';
import { createWorld, fakePortal } from './helpers/world.js';

async function get(world, settings = {}, language = 'fr') {
  const ack = await world.gladys.fake.widgetGet(WIDGET_KEY, { settings, language });
  assert.equal(ack.success, true, ack.error);
  validateWidgetContent(ack.data.content);
  return ack.data.content.components;
}

test('open: the countdown and the next closures', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const components = await get(world);
  assert.equal(components[0].text, 'Pont Chaban-Delmas');
  assert.deepEqual(
    components.slice(1, 3).map(({ label, value }) => [label, value]),
    [
      ['Circulation', 'Ouvert'],
      ['Prochaine fermeture dans', '16 h 04'],
    ],
  );
  const list = components.at(-1);
  assert.equal(list.items.length, 5);
  assert.deepEqual(list.items[0], {
    title: 'mer. 13 mai · 04:04 – 05:27',
    subtitle: 'passage de AMBITION',
    badge: { text: 'Totale', color: 'danger' },
  });
  assert.ok(components.length <= 8);
});

test('closed: the reopening time; settings hide the status and choose the rows', async (t) => {
  const world = await createWorld({ at: '2026-05-13T02:30:00Z' });
  t.after(() => world.app.stop());
  const components = await get(world, {}, 'en');
  assert.deepEqual(
    components.slice(1, 3).map(({ label, value }) => [label, value]),
    [
      ['Traffic', 'Closed'],
      ['Reopens at', '05:27'],
    ],
  );
  const short = await get(world, { rows: '3', show_status: false }, 'de');
  assert.deepEqual(
    short.map((component) => component.type),
    ['text', 'card-list'],
  );
  assert.equal(short[1].items.length, 3);
  assert.equal(short[1].items[0].subtitle, 'Durchfahrt von AMBITION');
});

test('the widget is titled with the name the device has in Gladys', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await world.gladys.fake.deviceCreated({ ...world.device(), name: 'Pont de la maison' });
  const components = await get(world);
  assert.equal(components[0].text, 'Pont de la maison');
});

test('nothing read yet, nothing announced', async (t) => {
  const failing = await createWorld({ portal: fakePortal({ fail: true }) });
  t.after(() => failing.app.stop());
  assert.equal((await get(failing))[1].text, "Les fermetures n'ont pas encore été lues.");
  const late = await createWorld({ at: '2027-01-10T10:00:00Z' });
  t.after(() => late.app.stop());
  assert.equal((await get(late, {}, 'es')).at(-1).text, 'Ningún cierre anunciado.');
});

test('the countdown reads days and hours, then hours and minutes', () => {
  const text = WIDGET_TEXT.fr;
  assert.equal(countdown(2 * 86_400_000 + 5 * 3_600_000, text), '2 j 5 h');
  assert.equal(countdown(3_600_000 + 4 * 60_000, text), '1 h 04');
  assert.equal(countdown(30_000, text), '0 h 01');
});
