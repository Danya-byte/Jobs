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
const BOT_TOKEN = "7745513073:AAEAXKeJal-t0jcQ8U4MIby9DSSSvZ_TS90";
const REVIEWS_FILE = path.join(__dirname, "reviews.json");

const bot = new Bot(BOT_TOKEN);
bot.api.config.use(hydrateFiles(bot.token));

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Telegram-Data', 'Authorization','Cache-Control','X-Requested-With'],
  credentials: true
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

app.get("/api/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || isNaN(userId)) return res.status(400).json({ error: "Invalid ID" });

    const user = await bot.api.getChat(userId);

    const avatarUrl = user.username
      ? `https://t.me/i/userpic/160/${user.username}.jpg`
      : 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp';

    res.json({
      id: userId,
      firstName: user.first_name || 'User',
      username: user.username || '',
      photoUrl: avatarUrl
    });

  } catch (e) {
    console.error('User error:', e);
    res.status(404).json({ error: "Профиль не найден" });
  }
});

app.post("/api/createInvoiceLink", async (req, res) => {
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData) return res.status(401).json({ error: "Missing Telegram data" });
    if (!validateTelegramData(telegramData)) return res.status(401).json({ error: "Invalid signature" });

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user"));
    if (!user?.id) return res.status(400).json({ error: "Invalid user data" });

    const { text, targetUserId } = req.body;
    const payload = `${user.id}_${Date.now()}`;

    const rawData = await fs.readFile(REVIEWS_FILE, "utf8");
    const reviewsData = JSON.parse(rawData || "{}");
    reviewsData[payload] = { text, authorUserId: user.id, targetUserId, date: new Date().toISOString() };
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
    console.error("Invoice error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/reviews", async (req, res) => {
  try {
    const { targetUserId } = req.query;
    if (!targetUserId) return res.status(400).json({ error: "Missing targetUserId" });

    const rawData = await fs.readFile(REVIEWS_FILE, 'utf8').catch(() => "{}");
    const reviews = JSON.parse(rawData);

    const filteredReviews = Object.entries(reviews).reduce((acc, [key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (item.targetUserId === targetUserId) acc.push(item);
        });
      } else if (value?.targetUserId === targetUserId) {
        acc.push(value);
      }
      return acc;
    }, []);

    res.json(filteredReviews);
  } catch (e) {
    console.error("Reviews error:", e);
    res.status(500).json({ error: "Failed to load reviews" });
  }
});

bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on("message:successful_payment", async (ctx) => {
  const payload = ctx.message.invoice_payload;
  console.log("Payment received for payload:", payload);

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

      console.log("Review published for user:", targetUserId);
      await ctx.reply("Отзыв опубликован! Спасибо!");
    }
  } catch (e) {
    console.error("Payment processing error:", e);
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