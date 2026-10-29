# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- A "Pont Chaban-Delmas" device for the dashboard and scene conditions: closed to traffic now, closure
  still due today, next closure and reopening, reason, total or partial, minutes until the closure,
  closures within 7 days and the date the schedule was updated, from the open data of Bordeaux
  Métropole. Closing and reopening follow the clock, even when the portal cannot be reached.
- Scene triggers "Closure tomorrow" (the day before, at the hour chosen), "Closure starts" and "Closure
  ends", each with a sentence ready to send, fired once even across restarts.
- Scene action "Read the next closure": the next closure, or the running one, in one sentence.
- Dashboard widget "Bridge closures": open or closed, countdown to the next closure or reopening time,
  and the next 3, 5 or 8 closures.
- "Check" action, texts in English, French, German and Spanish, times read in Europe/Paris (clock
  changes included) and shown in the time zone of Gladys.
