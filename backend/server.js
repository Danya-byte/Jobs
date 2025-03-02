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

// Инициализация бота Grammy
const bot = new Bot(BOT_TOKEN);
bot.api.config.use(hydrateFiles(bot.token));

const paidUsers = new Map();

app.use(express.json());
app.use(cors({
  origin: ["https://jobs-iota-one.vercel.app", "http://localhost:5173"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "X-Telegram-Data"],
}));

// Инициализация файла отзывов
async function initReviewsFile() {
  try {
    await fs.access(REVIEWS_FILE);
  } catch {
    await fs.writeFile(REVIEWS_FILE, "{}");
  }
}

// Валидация данных Telegram
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

// Маршрут для создания инвойса
app.post("/api/createInvoiceLink", async (req, res) => {
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData) return res.status(401).json({ error: "Missing Telegram data" });
    if (!validateTelegramData(telegramData)) return res.status(401).json({ error: "Invalid signature" });

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user"));
    if (!user?.id) return res.status(400).json({ error: "Invalid user data" });

    const invoice = {
      title: "Submit a Review",
      description: "Pay 1 Telegram Star to submit a review",
      currency: "XTR",
      prices: [{ label: "Review Submission", amount: 100 }],
      payload: `${user.id}_${Date.now()}`,
      provider_data: JSON.stringify({ user_id: user.id })
    };

    const invoiceLink = await bot.api.createInvoiceLink(invoice);
    res.json({ success: true, invoiceLink });
  } catch (error) {
    console.error("Invoice error:", error);
    res.status(500).json({
      success: false,
      error: error.description || error.message
    });
  }
});

// Остальные маршруты остаются без изменений
app.post("/api/submit-review", async (req, res) => {
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!validateTelegramData(telegramData)) return res.status(401).json({ error: "Invalid signature" });

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user"));
    const { text } = req.body;

    if (!text) return res.status(400).json({ error: "Missing review text" });
    if (!paidUsers.has(user.id)) return res.status(403).json({ error: "Payment required" });

    const reviewsData = await fs.readFile(REVIEWS_FILE, "utf8");
    const reviews = JSON.parse(reviewsData);
    reviews[user.id] = [...(reviews[user.id] || []), { text, date: new Date().toISOString() }];

    await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviews, null, 2));
    paidUsers.delete(user.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to submit review" });
  }
});

app.get("/api/reviews", async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: "Missing user_id" });

    const reviewsData = await fs.readFile(REVIEWS_FILE, "utf8");
    res.json(JSON.parse(reviewsData)[user_id] || []);
  } catch {
    res.status(500).json({ error: "Failed to load reviews" });
  }
});

// Обработчики платежей в Grammy
bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on("message:successful_payment", async (ctx) => {
  const userId = ctx.from.id;
  paidUsers.set(userId, ctx.message.successful_payment.telegram_payment_charge_id);
  await ctx.reply("Payment successful! You can now submit a review.");
});

// Запуск сервера и бота
initReviewsFile().then(() => {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    bot.start();
  });
});

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);