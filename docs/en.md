# Pont Chaban-Delmas

Closures to traffic of the Chaban-Delmas lift bridge in Bordeaux, from the open data of Bordeaux
Métropole: is the bridge closed now, the next closures, and scene alerts the day before, when it
closes and when it reopens. Not affiliated with Bordeaux Métropole.

## What you get

- A **Chaban-Delmas bridge** device, to add from the **Discovery** tab.
- Three scene triggers and one scene action (Gladys 5.3 or later).
- A **Bridge closures** dashboard widget.

## Installation

Nothing to set up: the dataset is public, free and needs no account. The integration reads it as
soon as it starts.

## Configuration

**Language of the texts**: language of the device and feature names, of the text values and of the
scene sentences (French by default). Names are set when the device is created: to rename them,
delete and re-add the device.

The **Check** button reads the schedule again now and shows the number of closures to come, the
next one and the date the schedule was updated.

## The device

| Feature                   | Value                                                    |
| ------------------------- | -------------------------------------------------------- |
| Closed to traffic now     | 1 during a closure, 0 otherwise                          |
| Closure still due today   | 1 when a closure is running or starts later today        |
| Next closure              | Day and time of the next closure (or of the running one) |
| Reopening                 | Day and time it reopens                                  |
| Reason of the closure     | Boat name, MAINTENANCE or event, as published            |
| Type of closure           | Total or partial                                         |
| Minutes until the closure | 0 while it is running                                    |
| Closures within 7 days    | Closures not over yet that start within 7 days           |
| Schedule updated          | When Bordeaux Métropole last updated the dataset         |

The device follows the clock: it switches to closed and back to open at the scheduled times, even
when the open data portal cannot be reached (the last schedule read is kept in `/data`).

## Scenes

### Triggers

- **Closure tomorrow**: the day before a closure, at the hour chosen (8:00, 12:00, 17:00 to 22:00),
  with every closure of the next day. Variables: sentence ready to send, number of closures, day,
  first closing and reopening times, first boat or event, total closure.
- **Closure starts**: at the scheduled closing time.
- **Closure ends**: at the scheduled reopening time.

The last two give the sentence, the boat or event, the reason (`boat`, `maintenance`, `event`), the
times, the duration and whether the closure is total. Use `{{triggerEvent.data.sentence}}` in a
message. Each event fires once, even after a restart; one missed while the integration was stopped
for more than 10 minutes is not sent late.

### Action

**Read the next closure**: a sentence such as "Next closure of the Chaban-Delmas bridge: Sunday,
November 8, from 07:00 to 15:00 (MARATHON DE BORDEAUX), total closure.", or "closed until…"
during a closure. Outputs: sentence, closed now, minutes until the closure (0 running, -1 none),
start, end, boat or event, total.

## Dashboard

The **Bridge closures** widget shows whether traffic is open or closed, the countdown to the next
closure (or the reopening time), and the next 3, 5 or 8 closures with their type. A setting hides
the status and countdown. It takes the name you gave the device in Gladys.

## Data, limits and quotas

- Source: dataset
  [Pont Chaban - Prévisions - Fermeture](https://opendata.bordeaux-metropole.fr/explore/dataset/previsions_pont_chaban/)
  of Bordeaux Métropole, Licence Ouverte (Etalab). Read every hour (every 10 minutes after a
  failure), two requests each time, far under the 50,000 calls a day the portal allows.
- These are **forecasts**: a boat may be late or cancelled, and the dataset is updated by hand,
  a few times a month. Times may change at short notice: check on the spot.
- Times are those of Bordeaux (Europe/Paris, clock changes included), shown in the time zone of
  Gladys. A reopening earlier than the closing is read as the next day (night maintenance).
- The reason (boat, maintenance, event) is guessed from the published label.
- No other French lift bridge publishes its closures as open data so far: this integration covers
  Chaban-Delmas only.

## Troubleshooting

- **The device stays empty**: the schedule has not been read yet; the connection status of the
  integration says why. Press **Check**.
- **"Cannot be reached"**: the open data portal is down or your Gladys has no Internet access. The
  last schedule read keeps being used.
- More details in the integration logs, with `LOG_LEVEL=debug`.
