const { Bot, Keyboard } = require("grammy");
const { hydrateFiles } = require("@grammyjs/files");
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const REVIEWS_FILE = path.join(__dirname, "reviews.json");

const bot = new Bot(BOT_TOKEN);
bot.api.config.use(hydrateFiles(bot.token));

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Telegram-Data', 'Authorization','Cache-Control','X-Requested-With'],
  credentials: true,
  exposedHeaders: ['X-Telegram-Data']
};

app.use(express.json());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

async function initReviewsFile() {
  try {
    await fs.access(REVIEWS_FILE);
  } catch {
    await fs.writeFile(REVIEWS_FILE, "{}");
  }
}

function validateTelegramData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const receivedHash = params.get("hash");
    const dataCheckString = Array.from(params.entries())
      .filter(([key]) => key !== "hash")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${key}=${val}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData")
      .update(BOT_TOKEN)
      .digest();

    return crypto.createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex") === receivedHash;
  } catch {
    return false;
  }
}

app.post("/api/createInvoiceLink", async (req, res) => {
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user"));
    const { text, targetUserId } = req.body;

    if (!user?.id || !targetUserId || !text) {
      return res.status(400).json({ error: "Invalid data" });
    }

    const payload = `${user.id}_${Date.now()}`;
    const rawData = await fs.readFile(REVIEWS_FILE, "utf8").catch(() => "{}");
    const reviewsData = JSON.parse(rawData);
    reviewsData[payload] = { authorUserId: user.id, targetUserId, text };
    await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviewsData, null, 2));

    const invoiceLink = await bot.api.createInvoiceLink(
      "Submit a Review",
      "Pay 1 Telegram Star to submit a review",
      payload,
      "",
      "XTR",
      [{ label: "Review Submission", amount: 1 }]
    );

    res.json({ success: true, invoiceLink });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

bot.on("message:successful_payment", async (ctx) => {
  const payload = ctx.message.invoice_payload;
  try {
    const rawData = await fs.readFile(REVIEWS_FILE, "utf8");
    const reviewsData = JSON.parse(rawData);
    if (reviewsData[payload]) {
      const { authorUserId, targetUserId, text } = reviewsData[payload];
      const userKey = `user_${targetUserId}`;
      reviewsData[userKey] = reviewsData[userKey] || [];
      reviewsData[userKey].push({
        text,
        authorUserId,
        authorUsername: (await bot.api.getChat(authorUserId)).username,
        date: new Date().toISOString()
      });
      delete reviewsData[payload];
      await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviewsData, null, 2));
      await ctx.reply("Отзыв опубликован! Спасибо!");
    }
  } catch (e) {
    console.error("Payment error:", e);
  }
});

initReviewsFile().then(() => {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    bot.start();
  });
});

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);