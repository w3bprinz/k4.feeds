import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import Parser from "rss-parser";
import nodeCron from "node-cron";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { ActivityType } from "discord.js";
import fs from "fs";

config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const parser = new Parser();
const botConfig = JSON.parse(readFileSync("config.json", "utf-8"));

// Pfad zur Datei für persistente Speicherung
const STORAGE_FILE = "/app/data/lastPosted.json";

// Stelle sicher, dass das Verzeichnis existiert
if (!fs.existsSync("/app/data")) {
  fs.mkdirSync("/app/data", { recursive: true });
}

// Lade gespeicherte Daten
let lastPostedItems = new Map();
try {
  if (fs.existsSync(STORAGE_FILE)) {
    const savedData = JSON.parse(fs.readFileSync(STORAGE_FILE, "utf-8"));
    lastPostedItems = new Map(Object.entries(savedData));
  }
} catch (error) {
  console.error("Fehler beim Laden der gespeicherten Daten:", error);
}

// Funktion zum Speichern der Daten
function saveLastPostedItems() {
  try {
    const dataToSave = Object.fromEntries(lastPostedItems);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(dataToSave, null, 2));
  } catch (error) {
    console.error("Fehler beim Speichern der Daten:", error);
  }
}

const activities = [
  { name: "RSS Feeds", type: ActivityType.Watching },
  { name: "neue Artikel", type: ActivityType.Listening },
  { name: `${botConfig.channels.length} Kanäle`, type: ActivityType.Watching },
  { name: "nach Updates", type: ActivityType.Searching },
];

let currentActivity = 0;

function updateStatus() {
  client.user.setActivity(activities[currentActivity].name, {
    type: activities[currentActivity].type,
  });

  // Zum nächsten Status rotieren
  currentActivity = (currentActivity + 1) % activities.length;
}

async function checkFeed(url, channel) {
  try {
    const feedData = await parser.parseURL(url);

    if (!lastPostedItems.has(url)) {
      const latestItem = feedData.items[0];
      lastPostedItems.set(url, {
        link: latestItem.link,
        date: new Date(latestItem.pubDate).toISOString(),
      });
      saveLastPostedItems();
      return;
    }

    const lastPosted = lastPostedItems.get(url);
    const lastPostedDate = new Date(lastPosted.date);

    const newItems = feedData.items.filter((item) => {
      const itemDate = new Date(item.pubDate);
      return itemDate > lastPostedDate && item.link !== lastPosted.link;
    });

    for (const item of newItems.reverse()) {
      // Suche nach einem Bild im Feed-Eintrag
      let imageUrl = null;

      // Prüfe verschiedene mögliche Bildquellen
      if (item.enclosure && item.enclosure.url && item.enclosure.type?.startsWith("image/")) {
        imageUrl = item.enclosure.url;
      } else if (item["media:content"] && item["media:content"].url) {
        imageUrl = item["media:content"].url;
      } else if (item.content) {
        // Suche nach dem ersten Bild im HTML-Content
        const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
        if (imgMatch) {
          imageUrl = imgMatch[1];
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(item.title)
        .setURL(item.link)
        .setDescription(item.contentSnippet || "Keine Beschreibung verfügbar")
        .setColor("#0099ff")
        .setTimestamp(new Date(item.pubDate))
        .setFooter({ text: `Quelle: ${new URL(url).hostname}` });

      // Füge das Bild hinzu, wenn eines gefunden wurde
      if (imageUrl) {
        embed.setImage(imageUrl);
      }

      await channel.send({ embeds: [embed] });

      // Neues Logging
      console.log(`Neuer Post: "${item.title}" wurde in #${channel.name} (${channel.guild.name}) gesendet`);
    }

    if (newItems.length > 0) {
      lastPostedItems.set(url, {
        link: newItems[newItems.length - 1].link,
        date: new Date(newItems[newItems.length - 1].pubDate).toISOString(),
      });
      saveLastPostedItems();
    }
  } catch (error) {
    console.error(`Fehler beim Überprüfen des Feeds ${url}:`, error);
  }
}

async function checkChannelFeeds(channelConfig) {
  try {
    const channel = await client.channels.fetch(channelConfig.channelId);
    for (const feedUrl of channelConfig.feeds) {
      await checkFeed(feedUrl, channel);
    }
  } catch (error) {
    console.error(`Fehler beim Überprüfen der Feeds für Channel ${channelConfig.name}:`, error);
  }
}

client.once("ready", async () => {
  console.log(`Bot ist eingeloggt als ${client.user.tag}`);

  // Initial Status setzen
  updateStatus();

  // Status alle 30 Sekunden ändern
  setInterval(updateStatus, 30000);

  // Sofortige erste Überprüfung aller Feeds
  console.log("Führe initiale Feed-Überprüfung durch...");
  for (const channelConfig of botConfig.channels) {
    await checkChannelFeeds(channelConfig);
  }
  console.log("Initiale Feed-Überprüfung abgeschlossen");

  // Reguläre Intervall-Überprüfung einrichten
  botConfig.channels.forEach((channelConfig) => {
    nodeCron.schedule(channelConfig.interval, () => {
      checkChannelFeeds(channelConfig);
    });
  });
});

client.login(process.env.DISCORD_TOKEN);
