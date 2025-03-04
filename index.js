import Discord from "discord.js";
import Parser from "rss-parser";
import cron from "node-cron";
import { config } from "dotenv";

config();

const client = new Discord.Client({
  intents: [Discord.Intents.FLAGS.Guilds],
});

const lastPostedItems = new Map();

async function checkFeed(url, channel) {
  try {
    const feedData = await Parser.parseURL(url);

    if (!lastPostedItems.has(url)) {
      lastPostedItems.set(url, feedData.items[0].link);
      return;
    }

    const lastPostedLink = lastPostedItems.get(url);
    const newItems = feedData.items.filter((item) => item.link !== lastPostedLink);

    for (const item of newItems.reverse()) {
      const embed = new Discord.EmbedBuilder()
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

  // Feeds für jeden Channel überprüfen
  config.channels.forEach((channelConfig) => {
    cron.schedule(channelConfig.interval, () => {
      checkChannelFeeds(channelConfig);
    });
  });
});

client.on("messageCreate", async (message) => {
  if (message.content === "!feeds") {
    const channels = require("./config.json").channels;
    for (const channel of channels) {
      await checkChannelFeeds(channel);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
