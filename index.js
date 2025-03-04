import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import Parser from "rss-parser";
import nodeCron from "node-cron";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { ActivityType } from "discord.js";
import fs from "fs";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

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

async function getArticleImage(url) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Prüfe Meta-Tags
    let imageUrl = $('meta[property="og:image"]').attr("content");
    if (isValidImageUrl(imageUrl)) return imageUrl;

    imageUrl = $('meta[property="og:image:secure_url"]').attr("content");
    if (isValidImageUrl(imageUrl)) return imageUrl;

    imageUrl = $('meta[name="twitter:image"]').attr("content");
    if (isValidImageUrl(imageUrl)) return imageUrl;

    // Prüfe Link-Rel
    imageUrl = $('link[rel="image_src"]').attr("href");
    if (isValidImageUrl(imageUrl)) return imageUrl;

    // Prüfe data-src Attribute
    imageUrl = $("img[data-src]").first().attr("data-src");
    if (isValidImageUrl(imageUrl)) return imageUrl;

    // Prüfe Element mit ID
    imageUrl = $("#post-image").attr("src");
    if (isValidImageUrl(imageUrl)) return imageUrl;

    // Fallback: Erstes Bild
    imageUrl = $("img").first().attr("src");
    if (isValidImageUrl(imageUrl)) return imageUrl;

    return null;
  } catch (error) {
    console.error("Fehler beim Holen des Artikelbildes:", error);
    return null;
  }
}

function isValidImageUrl(url) {
  if (!url) return false;
  return url.match(/\.(jpg|jpeg|png|webp|gif)/i) !== null;
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
      // Hole das Bild von der Artikel-Seite
      const imageUrl = await getArticleImage(item.link);

      const embed = new EmbedBuilder()
        .setTitle(item.title)
        .setURL(item.link)
        .setDescription(item.contentSnippet || "Keine Beschreibung verfügbar")
        .setColor("#0099ff")
        .setTimestamp(new Date(item.pubDate))
        .setFooter({ text: `Quelle: ${new URL(url).hostname}` });

      if (imageUrl) {
        embed.setImage(imageUrl);
      }

      await channel.send({ embeds: [embed] });
      logWithTimestamp(`Neuer Post: "${item.title}" wurde in #${channel.name} (${channel.guild.name}) gesendet`);
    }

    if (newItems.length > 0) {
      lastPostedItems.set(url, {
        link: newItems[newItems.length - 1].link,
        date: new Date(newItems[newItems.length - 1].pubDate).toISOString(),
      });
      saveLastPostedItems();
    }
  } catch (error) {
    logWithTimestamp(`Fehler beim Überprüfen des Feeds ${url}: ${error}`);
  }
}

async function checkChannelFeeds(channelConfig) {
  try {
    const channel = await client.channels.fetch(channelConfig.channelId);
    for (const feedUrl of channelConfig.feeds) {
      await checkFeed(feedUrl, channel);
    }
  } catch (error) {
    logWithTimestamp(`Fehler beim Überprüfen der Feeds für Channel ${channelConfig.name}:`, error);
  }
}

function logWithTimestamp(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

client.once("ready", async () => {
  logWithTimestamp(`Bot ist eingeloggt als ${client.user.tag}`);

  // Initial Status setzen
  updateStatus();

  // Status alle 30 Sekunden ändern
  setInterval(updateStatus, 30000);

  // Sofortige erste Überprüfung aller Feeds
  logWithTimestamp("Führe initiale Feed-Überprüfung durch...");
  for (const channelConfig of botConfig.channels) {
    await checkChannelFeeds(channelConfig);
  }
  logWithTimestamp("Initiale Feed-Überprüfung abgeschlossen");

  // Reguläre Intervall-Überprüfung einrichten
  botConfig.channels.forEach((channelConfig) => {
    // Log beim Einrichten des Jobs
    logWithTimestamp(`Richte Cron-Job für ${channelConfig.name} ein mit Intervall: ${channelConfig.interval}`);

    nodeCron.schedule(
      channelConfig.interval,
      async () => {
        try {
          logWithTimestamp(`Starte geplante Feed-Überprüfung für ${channelConfig.name}...`);
          await checkChannelFeeds(channelConfig);
          logWithTimestamp(`Feed-Überprüfung für ${channelConfig.name} abgeschlossen`);
        } catch (error) {
          logWithTimestamp(`Fehler im Cron-Job für ${channelConfig.name}: ${error}`);
        }
      },
      {
        scheduled: true,
        timezone: "Europe/Berlin",
      }
    );
  });

  // Log zur Bestätigung
  logWithTimestamp("Alle Cron-Jobs wurden eingerichtet");
});

client.login(process.env.DISCORD_TOKEN);
