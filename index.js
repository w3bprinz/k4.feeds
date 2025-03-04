import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import Parser from "rss-parser";
import nodeCron from "node-cron";
import { config } from "dotenv";
import { readFileSync } from "fs";
import { ActivityType } from "discord.js";

config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const parser = new Parser();
const botConfig = JSON.parse(readFileSync("config.json", "utf-8"));

// Speichert die zuletzt gesendeten Artikel
const lastPostedItems = new Map();

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
      lastPostedItems.set(url, feedData.items[0].link);
      return;
    }

    const lastPostedLink = lastPostedItems.get(url);
    const newItems = feedData.items.filter((item) => item.link !== lastPostedLink);

    for (const item of newItems.reverse()) {
      const embed = new EmbedBuilder()
        .setTitle(item.title)
        .setURL(item.link)
        .setDescription(item.contentSnippet || "Keine Beschreibung verfügbar")
        .setColor("#0099ff")
        .setTimestamp(new Date(item.pubDate))
        .setFooter({ text: `Quelle: ${new URL(url).hostname}` });

      await channel.send({ embeds: [embed] });
    }

    if (newItems.length > 0) {
      lastPostedItems.set(url, newItems[newItems.length - 1].link);
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
