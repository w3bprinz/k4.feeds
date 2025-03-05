# Discord RSS/Atom Feed Bot

Ein Discord Bot, der RSS/Atom Feeds überwacht und neue Einträge automatisch in konfigurierten Discord-Kanälen postet.

## Features

- 🔄 Automatische Feed-Überprüfung in konfigurierbaren Intervallen
- 📢 Unterstützung mehrerer Feeds pro Kanal
- 🖼️ Automatische Bildextraktion aus:
  - YouTube Feeds (Thumbnails)
  - Meta Tags (og:image, twitter:image)
  - Artikel-Inhalte
- 💾 Persistente Speicherung des letzten Stands
- 🕒 Konfigurierbare Prüfintervalle pro Kanal
- 📊 Detaillierte Logging-Funktionen
- 🔁 Automatischer Status-Rotator

## Installation

### Voraussetzungen

- Node.js v18+
- npm
- Discord Bot Token
- Docker (optional)

### Setup

1. Repository klonen:

```bash
git clone https://github.com/w3bprinz/k4.feeds
cd discord-rss-bot
```

2. Abhängigkeiten installieren:

```bash
npm install
```

3. Konfigurationsdateien erstellen:

`.env` Datei:

```env
DISCORD_TOKEN=dein_discord_bot_token
```

`config.json` Datei:

```json
{
  "channels": [
    {
      "channelId": "DISCORD_CHANNEL_ID",
      "interval": "*/30 * * * *",
      "name": "Channel Name",
      "feeds": ["https://example.com/feed.xml", "https://youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID"]
    }
  ]
}
```

## Konfiguration

### Feed-Konfiguration

- `channelId`: Discord Kanal ID
- `interval`: Cron-Syntax für Prüfintervall
- `name`: Anzeigename für Logs
- `feeds`: Array von Feed-URLs

### Cron-Intervalle

- `*/30 * * * *` - Alle 30 Minuten
- `*/15 * * * *` - Alle 15 Minuten
- `*/5 * * * *` - Alle 5 Minuten
- `*/1 * * * *` - Jede Minute

## Docker Installation

1. Image bauen:

```bash
docker build -t discord-rss-bot .
```

2. Container starten:

```bash
docker run -d \
  -v /path/to/config.json:/app/config.json \
  -v /path/to/.env:/app/.env \
  -v /path/to/data:/app/data \
  --name discord-rss-bot \
  discord-rss-bot
```

### UnRAID Installation

1. Apps → Docker
2. Add Container
3. Repository: `ghcr.io/w3bprinz/k4.feeds:latest`
4. Ports: keine erforderlich
5. Volumes:
   - `/mnt/user/appdata/discord-rss-bot/config.json:/app/config.json`
   - `/mnt/user/appdata/discord-rss-bot/.env:/app/.env`
   - `/mnt/user/appdata/discord-rss-bot/data:/app/data`

## Features im Detail

### Feed-Überprüfung

- Regelmäßige Überprüfung der konfigurierten Feeds
- Erkennung neuer Einträge basierend auf Datum und URL
- Vermeidung von Duplikaten

### Bildextraktion

- YouTube: Direkte Thumbnail-Extraktion
- Websites: Intelligente Bildsuche in:
  - Open Graph Meta-Tags
  - Twitter Card Meta-Tags
  - Artikel-Inhalt
  - Fallback auf erstes verfügbares Bild

### Status-Rotation

Der Bot zeigt abwechselnd verschiedene Status an:

- Watching RSS Feeds
- Listening neue Artikel
- Watching Kanäle
- Searching nach Updates

### Logging

Detaillierte Logs mit Zeitstempeln für:

- Feed-Überprüfungen
- Neue Posts
- Fehler
- System-Events

## Technische Details

### Verwendete Technologien

- discord.js
- node-cron
- rss-parser
- cheerio
- node-fetch

### Datenpersistenz

- Speicherung des letzten Stands in JSON-Datei
- Überlebt Neustarts und Updates
- Automatische Wiederherstellung

### Error Handling

- Robuste Fehlerbehandlung
- Automatische Wiederherstellung
- Detaillierte Fehlerprotokolle

## Support

Bei Fragen oder Problemen bitte ein Issue auf GitHub erstellen.

## Lizenz

MIT
