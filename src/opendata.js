// -----------------------------------------------------------------------------
// Bordeaux Métropole open data (Opendatasoft Explore API v2.1, no account, no
// key): the planned closures of the Chaban-Delmas bridge, and the date the
// dataset was last updated. 50,000 anonymous calls a day per address: the
// integration makes two an hour.
//
// The parser turns each record into a closure with two instants. The times are
// local to Bordeaux; a reopening earlier than the closing is the next day
// (maintenance from 23:00 to 05:00).
// -----------------------------------------------------------------------------

import { DAY, SOURCE_TIME_ZONE, localDate, nextDate, zonedInstant } from './time.js';

export const API_BASE = 'https://opendata.bordeaux-metropole.fr/api/explore/v2.1';
export const DATASET = 'previsions_pont_chaban';
export const DATASET_PAGE = `https://opendata.bordeaux-metropole.fr/explore/dataset/${DATASET}/`;
const TIMEOUT_MS = 20_000;
const LIMIT = 100;

export const REASONS = ['boat', 'maintenance', 'event'];

const MAINTENANCE = /MAINTENANCE|ENTRETIEN|TRAVAUX|ESSAI|INSPECTION/;
const EVENT =
  /MARATHON|COURSE|FETE|FESTIVAL|EVENEMENT|MANIFESTATION|FEU D|SPECTACLE|CONCERT|SEMI-|TRAIL|DEFILE|SOLIDAY|RUN\b/;

/** An error with the HTTP status, when there is one. */
export class OpenDataError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'OpenDataError';
    this.status = status;
  }
}

/**
 * @param {object} [options]
 * @param {Function} [options.fetch] the fetch to use (tests)
 * @param {string} [options.base] the API root (CHABAN_API_BASE)
 */
export function createOpenData({ fetch = globalThis.fetch, base } = {}) {
  const root = (base ?? process.env.CHABAN_API_BASE ?? API_BASE).replace(/\/+$/, '');

  async function getJson(url) {
    let response;
    try {
      response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'gladys-pont-chaban (+https://github.com/guim31/gladys-pont-chaban)',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const reason = err?.cause?.code ?? err?.name ?? 'network error';
      throw new OpenDataError(`Bordeaux Métropole open data unreachable (${reason})`);
    }
    if (!response.ok) {
      throw new OpenDataError(
        `Bordeaux Métropole open data answered HTTP ${response.status}${response.status === 429 ? ' (rate limited)' : ''}`,
        response.status,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new OpenDataError('Bordeaux Métropole open data sent an unreadable answer');
    }
  }

  return {
    /**
     * The closures from the day before `now` (a night closure may still be
     * running), in Bordeaux time.
     */
    async records(now) {
      const since = localDate(now - DAY, SOURCE_TIME_ZONE);
      const params = new URLSearchParams({
        where: `date_passage >= date'${since}'`,
        order_by: 'date_passage,fermeture_a_la_circulation',
        limit: String(LIMIT),
      });
      const body = await getJson(`${root}/catalog/datasets/${DATASET}/records?${params}`);
      if (!Array.isArray(body?.results)) {
        throw new OpenDataError('Bordeaux Métropole open data sent no list of closures');
      }
      return body.results;
    },
    /** When the dataset was last updated (ms), or null. */
    async modified() {
      const body = await getJson(`${root}/catalog/datasets/${DATASET}`);
      const metas = body?.metas?.default ?? {};
      const value = Date.parse(metas.data_processed ?? metas.modified ?? '');
      return Number.isFinite(value) ? value : null;
    },
  };
}

/** "Seadream  ii " → "SEADREAM II" (the dataset is in capitals, with typos). */
export function cleanLabel(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, 120);
}

/** Why the bridge closes: a boat, maintenance or an event (marathon…). */
export function reasonOf(label) {
  const folded = label.normalize('NFD').replace(/\p{M}/gu, '');
  if (MAINTENANCE.test(folded)) {
    return 'maintenance';
  }
  if (EVENT.test(folded)) {
    return 'event';
  }
  return 'boat';
}

/**
 * The records as closures, sorted by start, malformed ones left out.
 * @returns {{ id: string, start: number, end: number, label: string,
 *   reason: string, total: boolean }[]}
 */
export function parseClosures(records) {
  const closures = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const date = String(record?.date_passage ?? '').slice(0, 10);
    const closing = String(record?.fermeture_a_la_circulation ?? '').trim();
    const start = zonedInstant(date, closing);
    let end = zonedInstant(date, record?.re_ouverture_a_la_circulation);
    if (start === null || end === null) {
      continue;
    }
    if (end <= start) {
      // Reopened after midnight: the same wall-clock time, the next day.
      end = zonedInstant(nextDate(date), record.re_ouverture_a_la_circulation);
    }
    const label = cleanLabel(record.bateau) || 'MAINTENANCE';
    const kind = String(record.type_de_fermeture ?? '').toLowerCase();
    const flag = String(record.fermeture_totale ?? '')
      .trim()
      .toLowerCase();
    const total = flag ? flag === 'oui' : !kind.startsWith('partiel');
    const id = `${date}T${closing.padStart(5, '0')}`;
    if (!closures.has(id)) {
      closures.set(id, { id, start, end, label, reason: reasonOf(label), total });
    }
  }
  return [...closures.values()].sort((a, b) => a.start - b.start || a.end - b.end);
}
