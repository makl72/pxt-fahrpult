# Fahrpult – eigene Aktionen in MakeCode

BOT / CTRL für micro:bit mit ELECFREAKS IoT:bit und DFRobot micro:Driver DFR0548.

Die Erweiterung kapselt WLAN, MQTT, Sitzungsschlüssel, Sequenzprüfung, Telemetrie und den 600-ms-Motor-Watchdog. Die Bedienseite verwendet weiterhin das D/A/S/H-Textprotokoll. Ohne eigene Ereignisse funktionieren Motoren M1/M2, Servo S1, Schaltausgänge P2/P16 und Analogsensor P1 wie bisher.

## Schülerprojekt

`main.blocks` und `main.ts` sind leer. `verbindung.ts` enthält ausschließlich die vom Lehrenden eingetragenen Zugangsdaten und den Aufruf `fahrpult.verbinden(...)`; diese Datei liegt außerhalb der Blockfläche. Zugangsdaten werden nur lokal im Browser in die Projektdatei eingesetzt und stehen darin im Klartext. Keine Zugangsdaten in öffentliche Repositories laden.

Im Werkzeugkasten **Fahrpult**:

- **wenn Schalter 1/2 EIN/AUS** ersetzt die jeweilige Standardaktion.
- **wenn Fahrbefehl empfangen (links, rechts)** ersetzt das automatische Fahren. Typischer Inhalt: `Motor links [links] % rechts [rechts] %`.
- **wenn Fahrt gestoppt** ergänzt eine Aktion nach dem hardwareseitigen Motorstopp.
- **wenn Servo-Winkel empfangen (winkel)** ersetzt die automatische Servoaktion.
- **Servo auf … Grad**, **analoger Sensorwert (P1)** und **Ausgang von Schalter …** stehen als einfache Bausteine bereit.

Ohne eigenes Ereignis bleibt die Standardaktion aktiv. Nach Entfernen des letzten Ereignisses und erneuter Übertragung gilt wieder das Standardverhalten. Im Fahrereignis keine langen Pausen und keine Animationen mit Wartezeit verwenden. Es kommt etwa alle 150 ms.

## Einrichtung

Die Downloadseite erzeugt das Schülerprojekt bereits mit dieser Erweiterung und optional mit Zugangsdaten in `verbindung.ts`. Die Blockfläche bleibt leer. Beim Platzhalterprojekt müssen die Zugangsdaten über die Downloadseite ergänzt werden; alternativ den Block **Fahrpult einrichten** unter „Mehr“ in „beim Start“ einsetzen und ausklappen.

Der erste gültige Verbindungsaufruf gilt bis zum Reset. Spätere Aufrufe werden ignoriert. Das leere Platzhalterprojekt stellt keine Netzwerkverbindung her.

## Stoppverhalten

Ein gültiger neuer Fahrbefehl erlaubt Motoren für maximal 600 ms. Der Block `motoren` kann diese Frist nicht verlängern. Stoppbefehl, Taste B, Sitzungswechsel und Verbindungsabbruch setzen die Motoren unabhängig von Schülerereignissen direkt auf null. Eigene Stopphandler können die Motoren ohne neuen gültigen Fahrbefehl nicht wieder einschalten. Aktionen sind vom Fahr-Watchdog getrennt. Bei Taste B/Sitzungswechsel werden P2/P16 ausgeschaltet und eigene AUS-Handler aktiver Aktionen ausgeführt. Der Servo behält seine Position.

Die Schalter-Telemetrie bestätigt den empfangenen Sollzustand, keine externe Messung eines Verbrauchers. Der Servowert meldet die von dieser Erweiterung gesetzte Position, keine mechanische Messung. Wer direkt fremde Motorbibliotheken nutzt, kann die Schutzmechanismen umgehen; sie schützen die bereitgestellten Fahrpult-Motorblöcke. Ein echter Hardwaretest bleibt erforderlich.

## Anschlüsse

micro:bit im IoT:bit; Motorboard separat über P19/SCL, P20/SDA und gemeinsame Masse. IoT:bit P8/P12 sind für WLAN reserviert. Motoren M1/M2, Servo S1, Sensor P1, Aktionen P2/P16. Versorgung entsprechend der Einrichtungsseite.

for PXT/microbit
