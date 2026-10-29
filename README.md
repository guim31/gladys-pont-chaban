# Pont Chaban-Delmas for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) external integration for the closures to traffic of
the **Chaban-Delmas lift bridge** in Bordeaux, from the open data of Bordeaux Métropole: is the bridge
closed now, the next closures, scene alerts the day before, when it closes and when it reopens, and a
dashboard widget.

Not affiliated with Bordeaux Métropole.

## Features

- A **Chaban-Delmas bridge** device: closed to traffic now, closure still due today, next closure and
  reopening (day and time), reason (boat, maintenance, event), total or partial, minutes until the
  closure, closures within 7 days, date the schedule was updated. It follows the clock: closed and
  open at the scheduled times, even when the portal cannot be reached.
- Scene triggers **Closure tomorrow** (the day before, at an hour of your choice), **Closure starts**
  and **Closure ends**, each with a sentence ready to send.
- Scene action **Read the next closure**: the next closure (or the running one) in one sentence.
- Dashboard widget **Bridge closures**: open or closed, countdown, the next 3, 5 or 8 closures.
- Texts in English, French, German and Spanish; times in the Gladys time zone.

## Requirements

- Gladys Assistant **5.3.0** or later.
- Internet access from Gladys. No account, no API key.

## Installation

In Gladys, open **Integrations → Install from GitHub** and enter
`https://github.com/guim31/gladys-pont-chaban`. Then add the device from the **Discovery** tab.

The user documentation is in [`docs/`](docs/en.md) (English, French, German, Spanish).

## How it works

- The dataset
  [`previsions_pont_chaban`](https://opendata.bordeaux-metropole.fr/explore/dataset/previsions_pont_chaban/)
  (Opendatasoft Explore API v2.1, no key) is read every hour, every 10 minutes after a failure: two
  requests each time, far under the 50,000 a day the portal allows anonymously. The last answer is
  cached in `/data`.
- Each record is a date, a closing and a reopening time in Bordeaux: they are read explicitly in
  Europe/Paris, clock changes included; a reopening earlier than the closing is the next day.
- A one-minute clock in the container publishes the states that change and fires the scene triggers
  at their minute, once, remembered in `/data` across restarts. Gladys never polls the device.

## Limitations

- These are forecasts, updated by hand by Bordeaux Métropole: boats are late, cancelled, added at short
  notice. Check on the spot.
- The reason (boat, maintenance, event) is guessed from the published label.
- No other French lift bridge publishes its closures as open data so far (searched on data.gouv.fr in
  October 2026: Rouen, Brest, Le Havre, Dunkirk): this integration covers Chaban-Delmas only.

## Development

Node.js 22+, ESM, no build step. One runtime dependency:
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

```bash
npm install
npm test              # node --test, against the SDK's fake Gladys; no network
npm run lint
npm run format:check
npx -y github:GladysAssistant/integration-store --skip-image-check .   # store validator
```

```
index.js              SDK wiring (src/app.js registers the handlers)
src/app.js            every SDK handler -> the service, the "Check" action
src/service.js        the clock: readings, cache, states, scene triggers, status
src/opendata.js       Bordeaux Métropole client and parser
src/closures.js       running, next, within 7 days, starting on a day
src/device.js         the bridge device and its states
src/widgets.js        "Bridge closures" dashboard widget
src/scenes.js         "Read the next closure"
src/i18n.js           every text of the code, in four languages
src/time.js           Europe/Paris wall clock to instants, displays in the Gladys zone
src/config.js         DEFAULT_CONFIG (mirrors the manifest) + normalization
src/store.js          JSON files in /data
test/fixtures/        Gladys feature table, answers recorded from the portal on 2026-10-29
```

To run it outside Gladys:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="pont-chaban" \
CHABAN_DATA_DIR=./data \
TZ=Europe/Paris \
npm start
```

Releases are made by the **Release** workflow (Actions → Release); never edit the versions by hand. See
[`CLAUDE.md`](CLAUDE.md) for the project rules.

## Credits

- Data: [Bordeaux Métropole](https://opendata.bordeaux-metropole.fr/), dataset "Pont Chaban -
  Prévisions - Fermeture", [Licence Ouverte / Etalab](https://www.etalab.gouv.fr/licence-ouverte-open-licence/).
- Cover: a pictogram of the lift bridge drawn for this integration (no logo of Bordeaux Métropole is
  available under a free licence).
- Built from the official
  [Gladys integration template](https://github.com/GladysAssistant/integration-template-js).

## Disclaimer

Closure times are forecasts published by Bordeaux Métropole. They may be wrong or change without
notice: do not rely on this integration for safety or urgent travel.

## License

[Apache License 2.0](LICENSE).
