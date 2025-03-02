const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config();

const app = express();
const port = 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const REVIEWS_FILE = path.join(__dirname, "reviews.json");

const paidUsers = new Map();

app.use(express.json());
app.use(cors({
  origin: ["https://jobs-iota-one.vercel.app", "http://localhost:5173"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "X-Telegram-Data"],
}));

async function initReviewsFile() {
  try {
    await fs.access(REVIEWS_FILE);
  } catch {
    await fs.writeFile(REVIEWS_FILE, "{}");
  }
}

function validateTelegramData(initData) {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  params.delete("hash");

  const secretKey = crypto.createHash("sha256").update(BOT_TOKEN).digest();
  const checkString = Array.from(params.entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(checkString)
    .digest("hex");

  return calculatedHash === receivedHash;
}

app.post("/api/createInvoiceLink", async (req, res) => {
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user"));
    const payload = `${user.id}_${Date.now()}`;

    const invoiceLink = await bot.createInvoiceLink(
      "Submit a Review",
      "Pay 1 Telegram Star to submit a review",
      payload,
      "",
      "XTR",
      [{ label: "Review Submission", amount: 1 }]
    );

    res.json({ success: true, invoiceLink });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Submit review
app.post("/api/submit-review", async (req, res) => {
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user"));
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Missing review text" });
    }

    if (!paidUsers.has(user.id)) {
      return res.status(403).json({ error: "Payment required" });
    }

    const reviewsData = await fs.readFile(REVIEWS_FILE, "utf8");
    const reviews = JSON.parse(reviewsData);
    if (!reviews[user.id]) reviews[user.id] = [];
    reviews[user.id].push({ text, date: new Date().toISOString() });

    await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviews, null, 2));
    paidUsers.delete(user.id);
    res.sendStatus(200);
  } catch (error) {
    res.status(500).json({ error: "Failed to submit review" });
  }
});

app.get("/api/reviews", async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: "Missing user_id" });
    }

    const reviewsData = await fs.readFile(REVIEWS_FILE, "utf8");
    const reviews = JSON.parse(reviewsData);
    const userReviews = reviews[user_id] || [];
    res.json(userReviews);
  } catch (error) {
    res.status(500).json({ error: "Failed to load reviews" });
  }
});

bot.on("message", (msg) => {
  if (msg.successful_payment) {
    const userId = msg.from.id;
    paidUsers.set(userId, msg.successful_payment.telegram_payment_charge_id);
    bot.sendMessage(msg.chat.id, "Payment successful! You can now submit a review.");
  }
});

bot.on("pre_checkout_query", (query) => {
  bot.answerPreCheckoutQuery(query.id, true).catch((err) =>
    console.error("Pre-checkout query failed:", err)
  );
});

initReviewsFile().then(() => {
  app.listen(port, () => console.log(`Server running on port ${port}`));
});

