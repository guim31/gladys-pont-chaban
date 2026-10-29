// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CHECK_ACTION } from '../src/app.js';
import { DEFAULT_CONFIG, LANGUAGES } from '../src/config.js';
import { REASONS } from '../src/opendata.js';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { EVENING_HOURS, TRIGGERS, WIDGET_KEY } from '../src/service.js';
import { DEFAULT_ROWS, ROW_COUNTS, WIDGETS } from '../src/widgets.js';
import { createWorld } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

// Every list of form fields the manifest can declare (same field grammar).
const allFields = [
  ...(manifest.config_schema ?? []),
  ...[
    ...(manifest.actions ?? []),
    ...(manifest.scene_triggers ?? []),
    ...(manifest.scene_actions ?? []),
  ].flatMap((item) => item.fields ?? []),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];

// The handlers the integration actually registers on the SDK.
const registered = await createWorld({ connect: false });
const handlerKeys = (prefix) =>
  Object.keys(registered.gladys.handlers)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length));

const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const values = (field) => field.options.map((option) => option.value);
const trigger = (key) => manifest.scene_triggers.find((entry) => entry.key === key);
const field = (item, key) => item.fields.find((entry) => entry.key === key);

test('identity: name, image, cover, transports, category, country', () => {
  assert.equal(manifest.name, 'Pont Chaban-Delmas');
  assert.equal(manifest.type, 'device');
  assert.match(manifest.docker_image, /^ghcr\.io\/guim31\/gladys-pont-chaban:/);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-pont-chaban/main/cover.png',
  );
  // Everything comes from a public API on the Internet.
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.deepEqual(manifest.categories, ['services']);
  assert.deepEqual(manifest.countries, ['FR']);
});

test('countries requires Gladys >= 5.3.0', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
});

test('every manifest action has a registered handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.actions), [CHECK_ACTION]);
  assert.deepEqual(handlerKeys('action:'), [CHECK_ACTION]);
});

test('every scene action has a handler, and returns the declared outputs', async (t) => {
  assert.deepEqual(keysOf(manifest.scene_actions), Object.keys(SCENE_ACTIONS));
  assert.deepEqual(handlerKeys('sceneAction:'), Object.keys(SCENE_ACTIONS));
  for (const at of ['2026-05-12T10:00:00Z', '2027-01-10T10:00:00Z']) {
    const world = await createWorld({ at });
    t.after(() => world.app.stop());
    for (const action of manifest.scene_actions) {
      const ack = await world.gladys.fake.sceneAction(action.key, {});
      assert.equal(ack.success, true);
      assert.deepEqual(Object.keys(ack.data.outputs).sort(), keysOf(action.outputs).sort());
      for (const output of action.outputs) {
        assert.equal(typeof ack.data.outputs[output.key], output.type, output.key);
      }
    }
  }
});

test('the scene triggers fired are the declared ones, with their filters and variables', async (t) => {
  assert.deepEqual(keysOf(manifest.scene_triggers).sort(), Object.values(TRIGGERS).sort());
  for (const declared of manifest.scene_triggers) {
    const device = field(declared, 'device');
    assert.equal(device.source, 'devices');
    // One event per bridge: an empty filter means "any bridge", never twice.
    assert.equal(device.required, false);
  }
  const tomorrow = trigger(TRIGGERS.CLOSURE_TOMORROW);
  assert.deepEqual(values(field(tomorrow, 'hour')), EVENING_HOURS.map(String));
  assert.equal(field(tomorrow, 'hour').required, true, 'an empty hour matches every hour');
  assert.ok(values(field(tomorrow, 'hour')).includes(field(tomorrow, 'hour').default));

  const world = await createWorld();
  t.after(() => world.app.stop());
  await world.runUntil('2026-05-13T03:30:00Z');
  const fired = new Map(world.gladys.fake.sceneEvents.map((event) => [event.key, event.data]));
  assert.deepEqual([...fired.keys()].sort(), Object.values(TRIGGERS).sort());
  for (const declared of manifest.scene_triggers) {
    const data = fired.get(declared.key);
    for (const key of [...keysOf(declared.fields), ...keysOf(declared.variables)]) {
      assert.ok(key in data, `${declared.key}: "${key}" is in the event data`);
    }
    for (const variable of declared.variables) {
      assert.equal(typeof data[variable.key], variable.type, `${declared.key}.${variable.key}`);
    }
    for (const filter of declared.fields.filter((entry) => entry.options)) {
      assert.ok(values(filter).includes(String(data[filter.key])), `${declared.key}.${filter.key}`);
    }
    if ('reason' in data && declared.key !== TRIGGERS.CLOSURE_TOMORROW) {
      assert.ok(REASONS.includes(data.reason));
    }
  }
});

test('every widget has a handler, and its settings match the code', () => {
  assert.deepEqual(keysOf(manifest.widgets), [WIDGET_KEY]);
  assert.deepEqual(Object.keys(WIDGETS), [WIDGET_KEY]);
  assert.deepEqual(handlerKeys('widget:'), [WIDGET_KEY]);
  const settings = manifest.widgets[0].settings;
  assert.deepEqual(keysOf(settings), ['rows', 'show_status']);
  assert.deepEqual(values(settings[0]), ROW_COUNTS);
  assert.equal(settings[0].default, DEFAULT_ROWS);
  assert.equal(settings[1].default, true);
});

test('config_schema defaults and options stay consistent with the code', () => {
  for (const entry of manifest.config_schema) {
    if (entry.default !== undefined) {
      assert.deepEqual(DEFAULT_CONFIG[entry.key], entry.default, `DEFAULT_CONFIG.${entry.key}`);
    }
  }
  assert.deepEqual(
    Object.keys(DEFAULT_CONFIG).sort(),
    manifest.config_schema
      .filter((entry) => entry.type !== 'section')
      .map((entry) => entry.key)
      .sort(),
  );
  const language = manifest.config_schema.find((entry) => entry.key === 'language');
  assert.deepEqual(values(language), LANGUAGES);
});

test('section fields are purely presentational', () => {
  const sections = manifest.config_schema.filter((entry) => entry.type === 'section');
  assert.ok(sections.length > 0);
  for (const section of sections) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

test('number fields have integer bounds and defaults (the form has no step)', () => {
  for (const entry of allFields.filter((f) => f.type === 'number')) {
    for (const key of ['min', 'max', 'default']) {
      if (entry[key] !== undefined) {
        assert.ok(Number.isInteger(entry[key]), `field "${entry.key}".${key}`);
      }
    }
  }
});

test('no secret field anywhere: nothing here is secret', () => {
  assert.ok(allFields.every((entry) => entry.type !== 'secret'));
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`));
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});
