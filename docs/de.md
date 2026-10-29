# Pont Chaban-Delmas

Sperrungen der Hubbrücke Chaban-Delmas in Bordeaux für den Verkehr, aus den Open Data von Bordeaux
Métropole: Ist die Brücke jetzt gesperrt, die nächsten Sperrungen und Szenenalarme am Vortag, beim
Sperren und beim Wiederöffnen. Nicht mit Bordeaux Métropole verbunden.

## Was du bekommst

- Ein Gerät **Chaban-Delmas-Brücke**, hinzuzufügen im Tab **Entdecken**.
- Drei Szenenauslöser und eine Szenenaktion (Gladys 5.3 oder neuer).
- Ein Dashboard-Widget **Brückensperrungen**.

## Installation

Nichts einzustellen: Der Datensatz ist öffentlich, kostenlos und ohne Konto. Die Integration liest
ihn gleich beim Start.

## Konfiguration

**Sprache der Texte**: Sprache der Geräte- und Funktionsnamen, der Textwerte und der Szenensätze
(standardmäßig Französisch). Die Namen werden beim Anlegen festgelegt: Zum Umbenennen lösche das
Gerät und füge es erneut hinzu.

Die Schaltfläche **Prüfen** liest den Plan sofort neu und zeigt die Zahl der kommenden Sperrungen,
die nächste und das Datum der Aktualisierung.

## Das Gerät

| Funktion                   | Wert                                                           |
| -------------------------- | -------------------------------------------------------------- |
| Jetzt für Verkehr gesperrt | 1 während einer Sperrung, sonst 0                              |
| Sperrung heute noch        | 1, wenn eine Sperrung läuft oder heute noch beginnt            |
| Nächste Sperrung           | Tag und Uhrzeit der nächsten (oder laufenden) Sperrung         |
| Wiederöffnung              | Tag und Uhrzeit der Wiederöffnung                              |
| Grund der Sperrung         | Schiffsname, MAINTENANCE oder Ereignis, wie veröffentlicht     |
| Art der Sperrung           | Vollständig oder teilweise                                     |
| Minuten bis zur Sperrung   | 0, solange sie läuft                                           |
| Sperrungen in 7 Tagen      | Noch nicht beendete Sperrungen, die in 7 Tagen beginnen        |
| Plan aktualisiert          | Letzte Aktualisierung des Datensatzes durch Bordeaux Métropole |

Das Gerät folgt der Uhr: Es wechselt zu den geplanten Zeiten auf gesperrt und zurück auf offen,
auch wenn das Open-Data-Portal nicht erreichbar ist (der zuletzt gelesene Plan bleibt in `/data`).

## Szenen

### Auslöser

- **Sperrung morgen**: am Vortag einer Sperrung zur gewählten Uhrzeit (8:00, 12:00, 17:00 bis
  22:00), mit allen Sperrungen des nächsten Tages. Variablen: fertiger Satz, Zahl der Sperrungen,
  Tag, Uhrzeiten der ersten Sperrung und Wiederöffnung, erstes Schiff oder Ereignis, vollständige
  Sperrung.
- **Sperrung beginnt**: zur geplanten Uhrzeit der Sperrung.
- **Sperrung endet**: zur geplanten Uhrzeit der Wiederöffnung.

Die beiden letzten liefern den Satz, das Schiff oder Ereignis, den Grund (`boat`, `maintenance`,
`event`), die Uhrzeiten, die Dauer und ob die Sperrung vollständig ist. Nutze
`{{triggerEvent.data.sentence}}` in einer Nachricht. Jedes Ereignis wird nur einmal gesendet, auch
nach einem Neustart; eines, das während eines Stopps von mehr als 10 Minuten verpasst wurde, wird
nicht nachgeholt.

### Aktion

**Nächste Sperrung lesen**: ein Satz wie „Nächste Sperrung der Chaban-Delmas-Brücke: Sonntag, 8. November, von 07:00 bis 15:00 (MARATHON DE BORDEAUX), vollständige Sperrung.“, oder „gesperrt
bis …“ während einer Sperrung. Ausgaben: Satz, jetzt gesperrt, Minuten bis zur Sperrung (0 läuft,
-1 keine), Beginn, Ende, Schiff oder Ereignis, vollständig.

## Dashboard

Das Widget **Brückensperrungen** zeigt, ob der Verkehr frei oder gesperrt ist, den Countdown bis
zur nächsten Sperrung (oder die Uhrzeit der Wiederöffnung) und die nächsten 3, 5 oder 8 Sperrungen
mit ihrer Art. Eine Einstellung blendet Status und Countdown aus. Es übernimmt den Namen, den du dem
Gerät in Gladys gegeben hast.

## Daten, Grenzen und Kontingente

- Quelle: Datensatz
  [Pont Chaban - Prévisions - Fermeture](https://opendata.bordeaux-metropole.fr/explore/dataset/previsions_pont_chaban/)
  von Bordeaux Métropole, Licence Ouverte (Etalab). Stündlich gelesen (nach einem Fehler alle
  10 Minuten), jeweils zwei Anfragen, weit unter den 50.000 Aufrufen pro Tag des Portals.
- Es sind **Prognosen**: Ein Schiff kann sich verspäten oder ausfallen, und der Datensatz wird von
  Hand aktualisiert, einige Male im Monat. Uhrzeiten können sich kurzfristig ändern: Prüfe vor Ort.
- Die Uhrzeiten sind die von Bordeaux (Europe/Paris, Zeitumstellung inbegriffen), angezeigt in der
  Zeitzone von Gladys. Eine Wiederöffnung vor der Sperrung gilt als am nächsten Tag
  (Nachtwartung).
- Der Grund (Schiff, Wartung, Ereignis) wird aus der veröffentlichten Bezeichnung abgeleitet.
- Bisher veröffentlicht keine andere französische Hubbrücke ihre Sperrungen als Open Data: Diese
  Integration deckt nur Chaban-Delmas ab.

## Fehlerbehebung

- **Das Gerät bleibt leer**: Der Plan wurde noch nicht gelesen; der Verbindungsstatus der
  Integration sagt warum. Drücke **Prüfen**.
- **„Nicht erreichbar“**: Das Open-Data-Portal ist ausgefallen oder dein Gladys hat keinen
  Internetzugang. Der zuletzt gelesene Plan wird weiter verwendet.
- Mehr Details in den Protokollen der Integration, mit `LOG_LEVEL=debug`.
