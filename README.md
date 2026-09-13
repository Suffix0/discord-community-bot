# Discord Community Bot

Eigener Discord-Bot mit Ticket-System, Verify-Button, News-Posts und Vouches.

## Funktionen

- `/ticket-panel` – postet ein Ticket-Panel mit Button
- Pro Nutzer nur ein offenes, privates Ticket
- `/ticket add`, `/ticket remove`, `/ticket close`
- `/verify-panel` – vergibt beim Klick die konfigurierte Rolle
- `/news` – News-Embed mit Zielkanal, Bild und optionalem Ping
- `/vouch` – Discord-Nutzer, Discord-IDs, 1–5 Sterne, Text und optionales Beweisbild
- Eingebauter HTTP-Health-Endpunkt (`/health`) für kostenlose Web-Hoster

## Discord-App vorbereiten

1. Im [Discord Developer Portal](https://discord.com/developers/applications) eine Application erstellen.
2. Unter **Bot** einen Bot erstellen und den Token kopieren.
3. Unter **Bot > Privileged Gateway Intents** den **Server Members Intent** aktivieren.
4. Unter **OAuth2 > URL Generator** `bot` und `applications.commands` auswählen.
5. Bot-Rechte: `View Channels`, `Send Messages`, `Embed Links`, `Read Message History`, `Manage Channels` und `Manage Roles`.
6. Den Bot über die generierte URL einladen. Seine Bot-Rolle muss über der Verify-Rolle stehen.

## Einrichtung

```bash
npm install
```

`.env.example` zu `.env` kopieren und alle IDs eintragen. Discord-IDs lassen sich mit aktiviertem **Entwicklermodus** über Rechtsklick > **ID kopieren** auslesen.

```bash
npm start
```

Die Slash-Commands werden beim Start direkt auf dem in `GUILD_ID` angegebenen Server registriert.

## Kostenlos hosten

Der Bot braucht einen dauerhaft laufenden Node.js-Prozess oder Container. Das beiliegende `Dockerfile` funktioniert auf Container-Hostern und einem eigenen Server. Kostenlose Plattformen können schlafen, Kontingente ändern oder nach Verbrauch stoppen; deshalb ist „24/7 kostenlos“ nicht garantiert. Oracle Cloud bietet aktuell Always-Free-VMs, weist aber darauf hin, dass inaktive Compute-Instanzen zurückgefordert werden können. Am verlässlichsten ohne laufende Hostingkosten ist ein eigener PC, Mini-PC oder Raspberry Pi, der ohnehin dauerhaft läuft.

## Wichtige Rechte

- `Manage Channels` für Tickets
- `Manage Roles` für Verify
- `Send Messages` und `Embed Links` für Panels, News und Vouches
- Die Bot-Rolle muss in der Rollenliste **über** der Verify-Rolle stehen
