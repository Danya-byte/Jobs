const { Bot } = require("grammy");
const { hydrateFiles } = require("@grammyjs/files");
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
const { Mutex } = require("async-mutex");
const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const BOT_TOKEN = "7745513073:AAEAXKeJal-t0jcQ8U4MIby9DSSSvZ_TS90";
const REVIEWS_FILE = path.join(__dirname, "reviews.json");
const JOBS_FILE = path.join(__dirname, "jobs.json");
const LOGS_DIR = path.join(__dirname, "logs");
const ADMIN_IDS = ["1029594875", "1871247390", "1940359844", "6629517298", "6568279325"];

const jobsMutex = new Mutex();
const reviewsMutex = new Mutex();

let jobsData = [];
let reviewsData = {};

const bot = new Bot(BOT_TOKEN);
bot.api.config.use(hydrateFiles(bot.token));

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new DailyRotateFile({
      filename: path.join(LOGS_DIR, "%DATE%-app.log"),
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
    }),
  ],
});

app.use((req, res, next) => {
  const startTime = Date.now();
  const oldJson = res.json;

  res.json = function (data) {
    const duration = Date.now() - startTime;
    logger.info(
      `Request: ${req.method} ${req.path} | Body: ${JSON.stringify(req.body)} | Response: ${JSON.stringify(data)} | Status: ${res.statusCode} | Duration: ${duration}ms`
    );
    return oldJson.call(this, data);
  };

  next();
});

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Telegram-Data", "Authorization", "Cache-Control", "X-Requested-With"],
  credentials: true,
  exposedHeaders: ["X-Telegram-Data"],
};

app.use(express.json({ limit: "1mb" }));
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

async function initReviewsFile() {
  try {
    await fs.access(REVIEWS_FILE);
    const data = await fs.readFile(REVIEWS_FILE, "utf8");
    if (!data.trim()) await fs.writeFile(REVIEWS_FILE, "{}");
  } catch {
    await fs.writeFile(REVIEWS_FILE, "{}");
  }
  logger.info("Reviews file initialized");
}

async function initJobsFile() {
  try {
    await fs.access(JOBS_FILE);
    const data = await fs.readFile(JOBS_FILE, "utf8");
    if (!data.trim()) {
      const initialJobs = [
        {
          id: `${Date.now()}_1`,
          nick: "Matvey",
          userId: "1029594875",
          username: "whsxg",
          position: "Frontend Developer",
          profileLink: "/profile/1029594875",
          experience: "5",
          description: "Разработка Telegram Mini App по ТЗ с полным циклом от проектирования до запуска.",
          requirements: ["Опыт работы с Vue.js", "Знание HTML, CSS, JavaScript", "Интеграция с Telegram API"],
          tags: ["JavaScript", "Vue 3", "Telegram API"],
          contact: "https://t.me/workiks_admin",
        },
        {
          id: `${Date.now()}_2`,
          nick: "Danone",
          userId: "7079899705",
          username: "Danoneee777",
          position: "Moderator",
          profileLink: "/profile/7079899705",
          experience: "3",
          description: "Модерация сообществ и управление контентом.",
          requirements: ["Опыт работы с социальными сетями", "Коммуникативные навыки", "Знание основ модерации"],
          tags: ["Модерация", "Социальные сети"],
          contact: "https://t.me/Danoneee777",
        },
      ];
      await fs.writeFile(JOBS_FILE, JSON.stringify(initialJobs, null, 2));
    }
  } catch {
    await fs.writeFile(JOBS_FILE, JSON.stringify([], null, 2));
  }
  logger.info("Jobs file initialized");
}

async function loadJobs() {
  try {
    const rawData = await fs.readFile(JOBS_FILE, "utf8");
    jobsData = rawData.trim() ? JSON.parse(rawData) : [];
    logger.info(`Loaded ${jobsData.length} jobs into memory`);
  } catch (e) {
    logger.error(`Failed to load jobs: ${e.message}`);
    jobsData = [];
  }
}

async function loadReviews() {
  try {
    const rawData = await fs.readFile(REVIEWS_FILE, "utf8");
    reviewsData = rawData.trim() ? JSON.parse(rawData) : {};
    logger.info(`Loaded ${Object.keys(reviewsData).length} reviews into memory`);
  } catch (e) {
    logger.error(`Failed to load reviews: ${e.message}`);
    reviewsData = {};
  }
}

function validateTelegramData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const receivedHash = params.get("hash");
    if (!receivedHash) return false;

    const dataCheckString = Array.from(params.entries())
      .filter(([key]) => key !== "hash")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${key}=${val}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    return crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex") === receivedHash;
  } catch (e) {
    logger.error(`Error in validateTelegramData: ${e.message}`);
    return false;
  }
}

app.get("/api/jobs", async (req, res) => {
  res.json(jobsData);
});

app.post("/api/jobs", async (req, res) => {
  const release = await jobsMutex.acquire();
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    if (!user.id || !ADMIN_IDS.includes(user.id.toString())) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { userId, nick, position, experience, description, requirements, tags, contact } = req.body;
    if (!userId || !nick || !position || !description || !requirements || !tags || !contact) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newJob = {
      id: `${Date.now()}_${user.id}`,
      adminId: user.id,
      userId,
      username: req.body.username || "unknown",
      nick,
      position,
      profileLink: `/profile/${userId}`,
      experience,
      description,
      requirements,
      tags,
      contact,
    };

    jobsData.push(newJob);
    await fs.writeFile(JOBS_FILE, JSON.stringify(jobsData, null, 2));
    logger.info(`Job added by admin ${user.id}: ${newJob.id}`);

    res.json({ success: true, job: newJob });
  } catch (e) {
    logger.error(`Error in POST /api/jobs: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.delete("/api/jobs/:jobId", async (req, res) => {
  const release = await jobsMutex.acquire();
  try {
    const { jobId } = req.params;
    const telegramData = req.headers["x-telegram-data"];

    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    if (!user.id || !ADMIN_IDS.includes(user.id.toString())) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const jobIndex = jobsData.findIndex((job) => job.id === jobId);
    if (jobIndex === -1) {
      return res.status(404).json({ error: "Job not found" });
    }

    jobsData.splice(jobIndex, 1);
    await fs.writeFile(JOBS_FILE, JSON.stringify(jobsData, null, 2));
    logger.info(`Job deleted by admin ${user.id}: ${jobId}`);

    res.json({ success: true });
  } catch (e) {
    logger.error(`Error in DELETE /api/jobs: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.get("/api/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { username } = req.query;
    const telegramData = req.headers["x-telegram-data"];

    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const currentUser = JSON.parse(params.get("user") || "{}");

    let firstName = "Unknown";
    let photoUrl = "https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp";
    let responseUsername = null;

    if (currentUser.id && currentUser.id.toString() === userId) {
      firstName = currentUser.first_name || "Unknown";
      responseUsername = currentUser.username || null;
      if (currentUser.username) {
        photoUrl = `https://t.me/i/userpic/160/${currentUser.username}.jpg`;
      }
    } else if (username) {
      firstName = "User"; // Можно изменить на другое значение по умолчанию
      responseUsername = username;
      photoUrl = `https://t.me/i/userpic/160/${username}.jpg`;
    }

    res.json({ firstName, username: responseUsername, photoUrl });
  } catch (e) {
    logger.error(`Error in GET /api/user: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/createInvoiceLink", async (req, res) => {
  const release = await reviewsMutex.acquire();
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
    reviewsData[payload] = { text, authorUserId: user.id, targetUserId };
    await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviewsData, null, 2));
    logger.info(`Temporary review added by user ${user.id}: ${payload}`);

    const invoiceLink = await bot.api.createInvoiceLink(
      "Submit a Review",
      "Pay 1 Telegram Star to submit a review",
      payload,
      "",
      "XTR",
      [{ label: "Review Submission", amount: 1 }]
    );

    res.json({ success: true, invoiceLink });
  } catch (e) {
    logger.error(`Error in POST /api/createInvoiceLink: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.get("/api/reviews", async (req, res) => {
  try {
    const { targetUserId } = req.query;
    const reviews = Object.entries(reviewsData)
      .filter(([_, review]) => review.targetUserId === targetUserId && review.date)
      .map(([id, review]) => ({ id, ...review }));
    res.json(reviews);
  } catch (e) {
    logger.error(`Error in GET /api/reviews: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/reviews/:reviewId", async (req, res) => {
  const release = await reviewsMutex.acquire();
  try {
    const { reviewId } = req.params;
    const telegramData = req.headers["x-telegram-data"];

    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user"));

    if (!user.id || !ADMIN_IDS.includes(user.id.toString())) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!reviewsData[reviewId]) {
      return res.status(404).json({ error: "Review not found" });
    }

    delete reviewsData[reviewId];
    await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviewsData, null, 2));
    logger.info(`Review deleted by admin ${user.id}: ${reviewId}`);

    res.json({ success: true });
  } catch (e) {
    logger.error(`Error in DELETE /api/reviews: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.get("/api/isAdmin", async (req, res) => {
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    if (!user.id) {
      return res.status(400).json({ error: "Invalid user data" });
    }

    const isAdmin = ADMIN_IDS.includes(user.id.toString());
    res.json({ isAdmin });
  } catch (e) {
    logger.error(`Error in GET /api/isAdmin: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
  logger.info("Pre-checkout query processed");
});

bot.on("message:successful_payment", async (ctx) => {
  const release = await reviewsMutex.acquire();
  try {
    const payload = ctx.message.successful_payment.invoice_payload;

    if (!payload || !reviewsData[payload]) {
      await ctx.reply("Ошибка: не удалось обработать платеж. Обратитесь в поддержку.");
      logger.warn(`Payment processing failed: Invalid payload ${payload}`);
      return;
    }

    const { authorUserId, targetUserId, text } = reviewsData[payload];
    const reviewKey = `${authorUserId}_${Date.now()}`;
    reviewsData[reviewKey] = { text, authorUserId, targetUserId, date: new Date().toISOString() };
    delete reviewsData[payload];
    await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviewsData, null, 2));
    logger.info(`Review added from payment by user ${authorUserId}: ${reviewKey}`);

    await ctx.reply("Отзыв опубликован! Спасибо!");
  } catch (e) {
    logger.error(`Error in payment handler: ${e.message}`);
    await ctx.reply("Произошла ошибка при обработке отзыва.");
  } finally {
    release();
  }
});

async function cleanOldTempReviews() {
  const release = await reviewsMutex.acquire();
  try {
    const now = Date.now();
    let cleanedCount = 0;
    for (const [key, review] of Object.entries(reviewsData)) {
      if (!review.date && now - parseInt(key.split("_")[1]) > 60 * 60 * 1000) {
        delete reviewsData[key];
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviewsData, null, 2));
      logger.info(`Cleaned ${cleanedCount} old temporary reviews`);
    }
  } catch (e) {
    logger.error(`Error in cleanOldTempReviews: ${e.message}`);
  } finally {
    release();
  }
}

setInterval(cleanOldTempReviews, 10 * 60 * 1000);

async function ensureLogsDir() {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  } catch (e) {
    logger.error(`Failed to create logs directory: ${e.message}`);
  }
}

Promise.all([ensureLogsDir(), initReviewsFile(), initJobsFile()])
  .then(async () => {
    await loadJobs();
    await loadReviews();
    app.listen(port, () => {
      bot.start();
      logger.info(`Server running on port ${port}`);
    });
  })
  .catch((e) => {
    logger.error(`Failed to start server: ${e.message}`);
    process.exit(1);
  });

process.on("uncaughtException", (err) => logger.error(`Uncaught Exception: ${err.message}`));
process.on("unhandledRejection", (reason) => logger.error(`Unhandled Rejection: ${reason}`));