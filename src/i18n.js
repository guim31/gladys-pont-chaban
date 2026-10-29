// -----------------------------------------------------------------------------
// Every text the code produces, in the four languages of the Gladys interface.
// German says "du", Spanish "usted". The device has no user language: its
// names, its texts and the scene texts follow the `language` setting; the
// widget gets the language of the person looking at it. Boat names come from
// the dataset as they are: they are names.
// -----------------------------------------------------------------------------

/** Feature names, frozen by Gladys when the device is created. */
export const NAMES = {
  en: {
    device: 'Chaban-Delmas bridge',
    closed_now: 'Closed to traffic now',
    closure_today: 'Closure still due today',
    next_start: 'Next closure',
    next_end: 'Reopening',
    next_reason: 'Reason of the closure',
    next_type: 'Type of closure',
    next_countdown: 'Minutes until the closure',
    closures_7_days: 'Closures within 7 days',
    data_updated: 'Schedule updated',
  },
  fr: {
    device: 'Pont Chaban-Delmas',
    closed_now: 'Fermé à la circulation',
    closure_today: "Fermeture prévue aujourd'hui",
    next_start: 'Prochaine fermeture',
    next_end: 'Réouverture',
    next_reason: 'Motif de la fermeture',
    next_type: 'Type de fermeture',
    next_countdown: 'Minutes avant la fermeture',
    closures_7_days: 'Fermetures sous 7 jours',
    data_updated: 'Planning mis à jour',
  },
  de: {
    device: 'Chaban-Delmas-Brücke',
    closed_now: 'Jetzt für Verkehr gesperrt',
    closure_today: 'Sperrung heute noch',
    next_start: 'Nächste Sperrung',
    next_end: 'Wiederöffnung',
    next_reason: 'Grund der Sperrung',
    next_type: 'Art der Sperrung',
    next_countdown: 'Minuten bis zur Sperrung',
    closures_7_days: 'Sperrungen in 7 Tagen',
    data_updated: 'Plan aktualisiert',
  },
  es: {
    device: 'Puente Chaban-Delmas',
    closed_now: 'Cerrado al tráfico ahora',
    closure_today: 'Cierre previsto hoy',
    next_start: 'Próximo cierre',
    next_end: 'Reapertura',
    next_reason: 'Motivo del cierre',
    next_type: 'Tipo de cierre',
    next_countdown: 'Minutos hasta el cierre',
    closures_7_days: 'Cierres en 7 días',
    data_updated: 'Calendario actualizado',
  },
};

/** Text values of the device. */
export const STATE_TEXT = {
  en: { none: 'None announced', total: 'Total', partial: 'Partial' },
  fr: { none: 'Aucune annoncée', total: 'Totale', partial: 'Partielle' },
  de: { none: 'Keine angekündigt', total: 'Vollständig', partial: 'Teilweise' },
  es: { none: 'Ninguno anunciado', total: 'Total', partial: 'Parcial' },
};

/** Why the bridge closes, from the label of the dataset. */
export const REASON_TEXT = {
  en: {
    boat: (label) => `${label} passing`,
    maintenance: () => 'maintenance',
    event: (label) => label,
  },
  fr: {
    boat: (label) => `passage de ${label}`,
    maintenance: () => 'maintenance',
    event: (label) => label,
  },
  de: {
    boat: (label) => `Durchfahrt von ${label}`,
    maintenance: () => 'Wartung',
    event: (label) => label,
  },
  es: {
    boat: (label) => `paso del ${label}`,
    maintenance: () => 'mantenimiento',
    event: (label) => label,
  },
};

const until = {
  en: (w) => `${w.end}${w.endDay ? ` (${w.endDay})` : ''}`,
  fr: (w) => `${w.end}${w.endDay ? ` (${w.endDay})` : ''}`,
  de: (w) => `${w.end}${w.endDay ? ` (${w.endDay})` : ''}`,
  es: (w) => `${w.end}${w.endDay ? ` (${w.endDay})` : ''}`,
};

/**
 * Sentences ready to send. `w`: { bridge, day, start, end, endDay, why,
 * total } (src/scenes.js closureWords).
 */
export const SENTENCES = {
  en: {
    next: (w) =>
      `Next closure of the ${w.bridge}: ${w.day}, from ${w.start} to ${until.en(w)} (${w.why}), ${w.total ? 'total' : 'partial'} closure.`,
    closedNow: (w) =>
      `The ${w.bridge} is closed to traffic until ${until.en(w)} (${w.why}), ${w.total ? 'total' : 'partial'} closure.`,
    started: (w) => `The ${w.bridge} is now closed to traffic until ${until.en(w)} (${w.why}).`,
    ended: (w) => `The ${w.bridge} is open to traffic again.`,
    tomorrow: (bridge, day, list) =>
      `Tomorrow, ${day}, the ${bridge} closes ${list.length === 1 ? 'once' : `${list.length} times`}: ${list.map((w) => `from ${w.start} to ${until.en(w)} (${w.why})`).join('; ')}.`,
    none: (bridge) => `No closure of the ${bridge} is announced.`,
    noData: 'The closures of the bridge have not been read yet.',
  },
  fr: {
    next: (w) =>
      `Prochaine fermeture du ${w.bridge} : ${w.day}, de ${w.start} à ${until.fr(w)} (${w.why}), fermeture ${w.total ? 'totale' : 'partielle'}.`,
    closedNow: (w) =>
      `Le ${w.bridge} est fermé à la circulation jusqu'à ${until.fr(w)} (${w.why}), fermeture ${w.total ? 'totale' : 'partielle'}.`,
    started: (w) =>
      `Le ${w.bridge} est maintenant fermé à la circulation jusqu'à ${until.fr(w)} (${w.why}).`,
    ended: (w) => `Le ${w.bridge} est rouvert à la circulation.`,
    tomorrow: (bridge, day, list) =>
      `Demain, ${day}, le ${bridge} ferme ${list.length === 1 ? 'une fois' : `${list.length} fois`} : ${list.map((w) => `de ${w.start} à ${until.fr(w)} (${w.why})`).join(' ; ')}.`,
    none: (bridge) => `Aucune fermeture du ${bridge} n'est annoncée.`,
    noData: "Les fermetures du pont n'ont pas encore été lues.",
  },
  de: {
    next: (w) =>
      `Nächste Sperrung der ${w.bridge}: ${w.day}, von ${w.start} bis ${until.de(w)} (${w.why}), ${w.total ? 'vollständige' : 'teilweise'} Sperrung.`,
    closedNow: (w) =>
      `Die ${w.bridge} ist bis ${until.de(w)} für den Verkehr gesperrt (${w.why}), ${w.total ? 'vollständige' : 'teilweise'} Sperrung.`,
    started: (w) =>
      `Die ${w.bridge} ist jetzt bis ${until.de(w)} für den Verkehr gesperrt (${w.why}).`,
    ended: (w) => `Die ${w.bridge} ist wieder für den Verkehr geöffnet.`,
    tomorrow: (bridge, day, list) =>
      `Morgen, ${day}, wird die ${bridge} ${list.length === 1 ? 'einmal' : `${list.length}-mal`} gesperrt: ${list.map((w) => `von ${w.start} bis ${until.de(w)} (${w.why})`).join('; ')}.`,
    none: (bridge) => `Keine Sperrung der ${bridge} angekündigt.`,
    noData: 'Die Sperrungen der Brücke wurden noch nicht gelesen.',
  },
  es: {
    next: (w) =>
      `Próximo cierre del ${w.bridge}: ${w.day}, de ${w.start} a ${until.es(w)} (${w.why}), cierre ${w.total ? 'total' : 'parcial'}.`,
    closedNow: (w) =>
      `El ${w.bridge} está cerrado al tráfico hasta las ${until.es(w)} (${w.why}), cierre ${w.total ? 'total' : 'parcial'}.`,
    started: (w) =>
      `El ${w.bridge} está ahora cerrado al tráfico hasta las ${until.es(w)} (${w.why}).`,
    ended: (w) => `El ${w.bridge} vuelve a estar abierto al tráfico.`,
    tomorrow: (bridge, day, list) =>
      `Mañana, ${day}, el ${bridge} cierra ${list.length === 1 ? 'una vez' : `${list.length} veces`}: ${list.map((w) => `de ${w.start} a ${until.es(w)} (${w.why})`).join('; ')}.`,
    none: (bridge) => `No hay ningún cierre del ${bridge} anunciado.`,
    noData: 'Los cierres del puente aún no se han leído.',
  },
};

/** The bridge inside a sentence ("du pont Chaban-Delmas"). */
export const BRIDGE_IN_SENTENCE = {
  en: 'Chaban-Delmas bridge',
  fr: 'pont Chaban-Delmas',
  de: 'Chaban-Delmas-Brücke',
  es: 'puente Chaban-Delmas',
};

/** The dashboard widget, in the language of the person looking at it. */
export const WIDGET_TEXT = {
  en: {
    traffic: 'Traffic',
    open: 'Open',
    closed: 'Closed',
    nextIn: 'Next closure in',
    reopensAt: 'Reopens at',
    daysHours: (d, h) => `${d} d ${h} h`,
    hoursMinutes: (h, m) => `${h} h ${String(m).padStart(2, '0')}`,
    none: 'No closure announced.',
    noData: 'The closures have not been read yet.',
  },
  fr: {
    traffic: 'Circulation',
    open: 'Ouvert',
    closed: 'Fermé',
    nextIn: 'Prochaine fermeture dans',
    reopensAt: 'Réouverture à',
    daysHours: (d, h) => `${d} j ${h} h`,
    hoursMinutes: (h, m) => `${h} h ${String(m).padStart(2, '0')}`,
    none: 'Aucune fermeture annoncée.',
    noData: "Les fermetures n'ont pas encore été lues.",
  },
  de: {
    traffic: 'Verkehr',
    open: 'Offen',
    closed: 'Gesperrt',
    nextIn: 'Nächste Sperrung in',
    reopensAt: 'Wieder offen um',
    daysHours: (d, h) => `${d} T ${h} Std`,
    hoursMinutes: (h, m) => `${h} Std ${String(m).padStart(2, '0')}`,
    none: 'Keine Sperrung angekündigt.',
    noData: 'Die Sperrungen wurden noch nicht gelesen.',
  },
  es: {
    traffic: 'Tráfico',
    open: 'Abierto',
    closed: 'Cerrado',
    nextIn: 'Próximo cierre en',
    reopensAt: 'Reapertura a las',
    daysHours: (d, h) => `${d} d ${h} h`,
    hoursMinutes: (h, m) => `${h} h ${String(m).padStart(2, '0')}`,
    none: 'Ningún cierre anunciado.',
    noData: 'Los cierres aún no se han leído.',
  },
};

/** The report of the "Check" action. */
export const CHECK_TEXT = {
  en: {
    read: (count) => `Bordeaux Métropole: ${count} closure${count === 1 ? '' : 's'} to come.`,
    updated: (date) => `Schedule updated on ${date}.`,
    fresh: 'Data read just now.',
    stale: (error) =>
      `Could not read the data: ${error}. The integration keeps the last schedule read.`,
  },
  fr: {
    read: (count) => `Bordeaux Métropole : ${count} fermeture${count > 1 ? 's' : ''} à venir.`,
    updated: (date) => `Planning mis à jour le ${date}.`,
    fresh: "Données lues à l'instant.",
    stale: (error) => `Lecture impossible : ${error}. L'intégration garde le dernier planning lu.`,
  },
  de: {
    read: (count) =>
      `Bordeaux Métropole: ${count} ${count === 1 ? 'kommende Sperrung' : 'kommende Sperrungen'}.`,
    updated: (date) => `Plan aktualisiert am ${date}.`,
    fresh: 'Daten gerade gelesen.',
    stale: (error) =>
      `Lesen nicht möglich: ${error}. Die Integration behält den zuletzt gelesenen Plan.`,
  },
  es: {
    read: (count) => `Bordeaux Métropole: ${count} cierre${count === 1 ? '' : 's'} por venir.`,
    updated: (date) => `Calendario actualizado el ${date}.`,
    fresh: 'Datos leídos ahora mismo.',
    stale: (error) =>
      `No se pudieron leer los datos: ${error}. La integración conserva el último calendario leído.`,
  },
};

/** The connection status shown in Gladys, as an object per language. */
export const PROBLEM_TEXT = {
  en: {
    unreachable: () =>
      'Bordeaux Métropole open data cannot be reached: the last schedule read is kept.',
    limited: () => 'Bordeaux Métropole open data refuses too many requests: retrying later.',
  },
  fr: {
    unreachable: () =>
      "L'open data de Bordeaux Métropole est injoignable : le dernier planning lu est conservé.",
    limited: () =>
      "L'open data de Bordeaux Métropole refuse trop de requêtes : nouvel essai plus tard.",
  },
  de: {
    unreachable: () =>
      'Die Open Data von Bordeaux Métropole sind nicht erreichbar: Der zuletzt gelesene Plan bleibt.',
    limited: () =>
      'Die Open Data von Bordeaux Métropole lehnen zu viele Anfragen ab: neuer Versuch später.',
  },
  es: {
    unreachable: () =>
      'Los datos abiertos de Bordeaux Métropole no responden: se conserva el último calendario leído.',
    limited: () =>
      'Los datos abiertos de Bordeaux Métropole rechazan demasiadas solicitudes: nuevo intento más tarde.',
  },
};

export const INIT_FAILED = {
  en: 'The integration could not start: see its logs.',
  fr: "L'intégration n'a pas pu démarrer : voir ses journaux.",
  de: 'Die Integration konnte nicht starten: siehe ihre Protokolle.',
  es: 'La integración no pudo iniciarse: consulte sus registros.',
};

/** { en, fr, de, es } from a table and a function of one entry. */
export function inEveryLanguage(table, pick) {
  return Object.fromEntries(
    Object.entries(table).map(([lang, entry]) => [lang, pick(entry, lang)]),
  );
}
