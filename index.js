import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import Parser from "rss-parser";
import nodeCron from "node-cron";
import { config } from "dotenv";
import { readFileSync } from "fs";

config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const parser = new Parser();
const botConfig = JSON.parse(readFileSync("config.json", "utf-8"));

// Speichert die zuletzt gesendeten Artikel
const lastPostedItems = new Map();

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

client.once("ready", () => {
  console.log(`Bot ist eingeloggt als ${client.user.tag}`);

  botConfig.channels.forEach((channelConfig) => {
    nodeCron.schedule(channelConfig.interval, () => {
      checkChannelFeeds(channelConfig);
    });
  });
});

client.login(process.env.DISCORD_TOKEN);
