// -----------------------------------------------------------------------------
// The open data client and parser, on the answer recorded on 2026-10-29, and
// the Europe/Paris times around the clock changes (25/10/2026, 28/03/2027).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanLabel, createOpenData, parseClosures, reasonOf } from '../src/opendata.js';
import { formatDateTime, zonedInstant } from '../src/time.js';
import { fakePortal, fixture } from './helpers/world.js';

const iso = (ms) => new Date(ms).toISOString();

test('the recorded schedule gives 98 closures, sorted, with their reasons', () => {
  const closures = parseClosures(fixture('records-2026-10-29').results);
  assert.equal(closures.length, 98);
  for (let i = 1; i < closures.length; i += 1) {
    assert.ok(closures[i - 1].start <= closures[i].start);
  }
  assert.ok(closures.every((closure) => closure.end > closure.start && closure.total));
  const marathon = closures.find((closure) => closure.label === 'MARATHON DE BORDEAUX');
  assert.equal(marathon.reason, 'event');
  assert.equal(iso(marathon.start), '2026-11-08T06:00:00.000Z'); // 07:00 winter time
  assert.equal(iso(marathon.end), '2026-11-08T14:00:00.000Z');
  const counts = Object.groupBy(closures, (closure) => closure.reason);
  assert.equal(counts.maintenance.length, 10);
  assert.equal(counts.event.length, 1);
  // "BALMORAl" in the dataset: the same boat.
  assert.equal(closures.filter((closure) => closure.label === 'BALMORAL').length, 6);
});

test('a reopening before the closing is the next day', () => {
  const [night] = parseClosures([
    {
      bateau: 'MAINTENANCE',
      date_passage: '2026-11-15',
      fermeture_a_la_circulation: '23:00',
      re_ouverture_a_la_circulation: '05:00',
      type_de_fermeture: 'Totale',
      fermeture_totale: 'oui',
    },
  ]);
  assert.equal(iso(night.start), '2026-11-15T22:00:00.000Z');
  assert.equal(iso(night.end), '2026-11-16T04:00:00.000Z');
  assert.equal(night.id, '2026-11-15T23:00');
});

test('Europe/Paris on the nights the clocks change', () => {
  // 25/10/2026: 03:00 summer time becomes 02:00 winter time.
  assert.equal(iso(zonedInstant('2026-10-24', '23:00')), '2026-10-24T21:00:00.000Z');
  assert.equal(iso(zonedInstant('2026-10-25', '02:30')), '2026-10-25T00:30:00.000Z'); // first one
  assert.equal(iso(zonedInstant('2026-10-25', '05:00')), '2026-10-25T04:00:00.000Z');
  const [autumn] = parseClosures([
    {
      bateau: 'MAINTENANCE',
      date_passage: '2026-10-24',
      fermeture_a_la_circulation: '23:00',
      re_ouverture_a_la_circulation: '05:00',
      fermeture_totale: 'oui',
    },
  ]);
  assert.equal((autumn.end - autumn.start) / 3_600_000, 7, 'the night lasts an hour more');
  // 28/03/2027: 02:00 winter time becomes 03:00 summer time; 02:30 does not exist.
  assert.equal(iso(zonedInstant('2027-03-28', '01:30')), '2027-03-28T00:30:00.000Z');
  assert.equal(iso(zonedInstant('2027-03-28', '02:30')), '2027-03-28T01:30:00.000Z');
  assert.equal(iso(zonedInstant('2027-03-28', '05:00')), '2027-03-28T03:00:00.000Z');
  const [spring] = parseClosures([
    {
      bateau: 'MAINTENANCE',
      date_passage: '2027-03-27',
      fermeture_a_la_circulation: '23:00',
      re_ouverture_a_la_circulation: '05:00',
      fermeture_totale: 'oui',
    },
  ]);
  assert.equal((spring.end - spring.start) / 3_600_000, 5, 'the night lasts an hour less');
  // Shown in the zone of Gladys, whatever it is.
  assert.equal(formatDateTime(spring.end, 'fr', 'Europe/Paris'), 'dim. 28 mars · 05:00');
  assert.equal(formatDateTime(spring.end, 'en', 'America/Montreal'), 'Sat, Mar 27 · 23:00');
});

test('malformed records are left out, a partial closure is read as such', () => {
  const closures = parseClosures([
    {
      bateau: 'X',
      date_passage: '2026-04-31',
      fermeture_a_la_circulation: '10:00',
      re_ouverture_a_la_circulation: '11:00',
    },
    {
      bateau: 'X',
      date_passage: '2026-05-01',
      fermeture_a_la_circulation: '25:00',
      re_ouverture_a_la_circulation: '11:00',
    },
    {
      bateau: 'X',
      date_passage: null,
      fermeture_a_la_circulation: '10:00',
      re_ouverture_a_la_circulation: '11:00',
    },
    {
      bateau: ' seadream  ii ',
      date_passage: '2026-05-02',
      fermeture_a_la_circulation: '9h05',
      re_ouverture_a_la_circulation: '10:00',
      type_de_fermeture: 'Partielle',
      fermeture_totale: 'non',
    },
    {
      bateau: 'Y',
      date_passage: '2026-05-03',
      fermeture_a_la_circulation: '10:00',
      re_ouverture_a_la_circulation: '11:00',
      type_de_fermeture: 'Partielle',
    },
    null,
  ]);
  assert.deepEqual(
    closures.map(({ label, total }) => [label, total]),
    [
      ['SEADREAM II', false],
      ['Y', false],
    ],
  );
  assert.equal(parseClosures(undefined).length, 0);
});

test('reasons: maintenance, events, boats', () => {
  assert.equal(reasonOf(cleanLabel('Maintenance')), 'maintenance');
  assert.equal(reasonOf(cleanLabel('Fête du fleuve')), 'event');
  assert.equal(reasonOf(cleanLabel('MARATHON DE BORDEAUX')), 'event');
  assert.equal(reasonOf(cleanLabel('BELEM')), 'boat');
  assert.equal(reasonOf(cleanLabel('SEVEN SEAS GRANDEUR')), 'boat');
});

test('the client asks for the closures from yesterday on, and reads the update date', async () => {
  const portal = fakePortal();
  const api = createOpenData({ fetch: portal.fetch, base: 'https://example.invalid/api/' });
  const records = await api.records(Date.parse('2026-10-29T10:00:00Z'));
  assert.equal(records.length, 98);
  assert.equal(
    portal.calls[0],
    '/api/catalog/datasets/previsions_pont_chaban/records?where=date_passage+%3E%3D+date%272026-10-28%27&order_by=date_passage%2Cfermeture_a_la_circulation&limit=100',
  );
  assert.equal(new Date(await api.modified()).toISOString(), '2026-10-23T13:29:55.000Z');
});

test('the client turns failures into short messages', async () => {
  const portal = fakePortal({ status: 503 });
  const api = createOpenData({ fetch: portal.fetch, base: 'https://example.invalid/api' });
  await assert.rejects(api.records(0), {
    message: 'Bordeaux Métropole open data answered HTTP 503',
    status: 503,
  });
  portal.status = 429;
  await assert.rejects(api.modified(), { message: /HTTP 429 \(rate limited\)/, status: 429 });
  portal.fail = true;
  await assert.rejects(api.records(0), {
    message: 'Bordeaux Métropole open data unreachable (ENOTFOUND)',
  });
  const broken = createOpenData({
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ results: 'no' }) }),
  });
  await assert.rejects(broken.records(0), { message: /no list of closures/ });
});
