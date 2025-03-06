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
const SUBSCRIPTIONS_FILE = path.join(__dirname, "subscriptions.json");
const VACANCIES_FILE = path.join(__dirname, "vacancies.json");
const COMPANY_SUBSCRIPTIONS_FILE = path.join(__dirname, "companySubscriptions.json");
const LOGS_DIR = path.join(__dirname, "logs");
const ADMIN_IDS = ["1029594875", "1871247390", "1940359844", "6629517298", "6568279325"];

const jobsMutex = new Mutex();
const reviewsMutex = new Mutex();
const subscriptionsMutex = new Mutex();
const vacanciesMutex = new Mutex();
const companySubscriptionsMutex = new Mutex();

let jobsData = [];
let reviewsData = {};
let subscriptionsData = {};
let vacanciesData = [];
let companySubscriptionsData = [];

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
}

async function initJobsFile() {
  try {
    await fs.access(JOBS_FILE);
    const data = await fs.readFile(JOBS_FILE, "utf8");
    if (!data.trim()) await fs.writeFile(JOBS_FILE, "[]");
  } catch {
    await fs.writeFile(JOBS_FILE, "[]");
  }
}

async function initSubscriptionsFile() {
  try {
    await fs.access(SUBSCRIPTIONS_FILE);
    const data = await fs.readFile(SUBSCRIPTIONS_FILE, "utf8");
    if (!data.trim()) await fs.writeFile(SUBSCRIPTIONS_FILE, "{}");
  } catch {
    await fs.writeFile(SUBSCRIPTIONS_FILE, "{}");
  }
}

async function initVacanciesFile() {
  try {
    await fs.access(VACANCIES_FILE);
    const data = await fs.readFile(VACANCIES_FILE, "utf8");
    if (!data.trim()) await fs.writeFile(VACANCIES_FILE, "[]");
  } catch {
    await fs.writeFile(VACANCIES_FILE, "[]");
  }
}

async function initCompanySubscriptionsFile() {
  try {
    await fs.access(COMPANY_SUBSCRIPTIONS_FILE);
    const data = await fs.readFile(COMPANY_SUBSCRIPTIONS_FILE, "utf8");
    if (!data.trim()) await fs.writeFile(COMPANY_SUBSCRIPTIONS_FILE, "{}");
  } catch {
    await fs.writeFile(COMPANY_SUBSCRIPTIONS_FILE, "{}");
  }
}

async function loadJobs() {
  try {
    const rawData = await fs.readFile(JOBS_FILE, "utf8");
    jobsData = rawData.trim() ? JSON.parse(rawData) : [];
  } catch (e) {
    jobsData = [];
  }
}

async function loadReviews() {
  try {
    const rawData = await fs.readFile(REVIEWS_FILE, "utf8");
    reviewsData = rawData.trim() ? JSON.parse(rawData) : {};
  } catch (e) {
    reviewsData = {};
  }
}

async function loadSubscriptions() {
  try {
    const rawData = await fs.readFile(SUBSCRIPTIONS_FILE, "utf8");
    subscriptionsData = rawData.trim() ? JSON.parse(rawData) : {};
  } catch (e) {
    subscriptionsData = {};
  }
}

async function loadVacancies() {
  try {
    const rawData = await fs.readFile(VACANCIES_FILE, "utf8");
    vacanciesData = rawData.trim() ? JSON.parse(rawData) : [];
  } catch (e) {
    vacanciesData = [];
  }
}

async function loadCompanySubscriptions() {
  try {
    const rawData = await fs.readFile(COMPANY_SUBSCRIPTIONS_FILE, "utf8");
    companySubscriptionsData = rawData.trim() ? JSON.parse(rawData) : {};
  } catch (e) {
    companySubscriptionsData = {};
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

    const { userId, nick, position, experience, description, requirements, tags, categories } = req.body;
    if (!userId || !nick || !position || !description || !requirements || !tags) {
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
      categories: categories || [],
      contact: "https://t.me/workiks_admin",
      createdAt: new Date().toISOString()
    };

    jobsData.push(newJob);
    await fs.writeFile(JOBS_FILE, JSON.stringify(jobsData, null, 2));

    res.json({ success: true, job: newJob });
  } catch (e) {
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

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.get("/api/vacancies", async (req, res) => {
  res.json(vacanciesData);
});

app.post("/api/vacancies", async (req, res) => {
  const release = await vacanciesMutex.acquire();
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
    const { companyUserId, companyName, position, description, requirements, tags, categories, contact, officialWebsite, verified, photoUrl } = req.body;
    if (!companyUserId || !companyName || !position || !description || !requirements || !tags || !contact || !officialWebsite || !photoUrl) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const newVacancy = {
      id: `${Date.now()}_${user.id}`,
      adminId: user.id,
      companyUserId,
      companyName,
      position,
      description,
      requirements,
      tags,
      categories: categories || [],
      contact,
      officialWebsite,
      verified: verified || false,
      photoUrl,
      createdAt: new Date().toISOString()
    };
    vacanciesData.push(newVacancy);
    await fs.writeFile(VACANCIES_FILE, JSON.stringify(vacanciesData, null, 2));

    const companyId = newVacancy.companyUserId.toString();
    const subscribers = Object.entries(companySubscriptionsData)
      .filter(([_, companies]) => companies.includes(companyId))
      .map(([userId]) => userId);

    for (const subscriberId of subscribers) {
      try {
        await bot.api.sendMessage(
          subscriberId,
          `🏢 Компания "${newVacancy.companyName}" разместила новую вакансию:\n\n` +
          `📌 ${newVacancy.position}\n` +
          `📝 ${newVacancy.description}\n` +
          `🔗 ${newVacancy.contact}`
        );
      } catch (e) {
        logger.error(`Failed to notify user ${subscriberId}: ${e.message}`);
      }
    }

    res.json({ success: true, vacancy: newVacancy });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.delete("/api/vacancies/:vacancyId", async (req, res) => {
  const release = await vacanciesMutex.acquire();
  try {
    const { vacancyId } = req.params;
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");
    if (!user.id || !ADMIN_IDS.includes(user.id.toString())) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const vacancyIndex = vacanciesData.findIndex((vacancy) => vacancy.id === vacancyId);
    if (vacancyIndex === -1) {
      return res.status(404).json({ error: "Vacancy not found" });
    }
    vacanciesData.splice(vacancyIndex, 1);
    await fs.writeFile(VACANCIES_FILE, JSON.stringify(vacanciesData, null, 2));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.get("/api/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const telegramData = req.headers["x-telegram-data"];

    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userJob = jobsData.find(job => job.userId.toString() === userId);
    const userVacancy = vacanciesData.find(vacancy => vacancy.companyUserId.toString() === userId);
    let firstName = "Unknown";
    let photoUrl = "https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp";
    let responseUsername = null;

    if (userJob || userVacancy) {
      try {
        const userData = await bot.api.getChat(userJob ? userJob.userId : userVacancy.companyUserId);
        firstName = userData.first_name || "Unknown";
        responseUsername = userData.username || null;
        if (responseUsername) {
          photoUrl = `https://t.me/i/userpic/160/${responseUsername}.jpg`;
        }
      } catch (telegramError) {
        firstName = userJob ? userJob.nick : userVacancy ? userVacancy.companyName : "Unknown";
        responseUsername = userJob ? userJob.username : userVacancy ? null : null;
        if (responseUsername) {
          photoUrl = `https://t.me/i/userpic/160/${responseUsername}.jpg`;
        }
      }
    }

    res.json({ firstName, username: responseUsername, photoUrl });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/subscribe", async (req, res) => {
  const release = await subscriptionsMutex.acquire();
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { userId, category } = req.body;
    if (!userId || !category) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!subscriptionsData[userId]) {
      subscriptionsData[userId] = [];
    }

    if (!subscriptionsData[userId].includes(category)) {
      subscriptionsData[userId].push(category);
      await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptionsData, null, 2));
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.post("/api/unsubscribe", async (req, res) => {
  const release = await subscriptionsMutex.acquire();
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { userId, category } = req.body;
    if (!userId || !category) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (subscriptionsData[userId]) {
      subscriptionsData[userId] = subscriptionsData[userId].filter(cat => cat !== category);
      if (subscriptionsData[userId].length === 0) {
        delete subscriptionsData[userId];
      }
      await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptionsData, null, 2));
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.post("/api/toggleFavorite", async (req, res) => {
  const releaseCompanySubs = await companySubscriptionsMutex.acquire();
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");
    const { itemId } = req.body;

    if (!user.id || !itemId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const vacancy = vacanciesData.find(v => v.id === itemId);
    if (!vacancy) {
      return res.status(400).json({ error: "Only vacancies can be subscribed to" });
    }

    const favoriteJobs = JSON.parse(await fs.readFile(path.join(__dirname, "favoriteJobs.json"), "utf8") || "[]");
    const favoriteIndex = favoriteJobs.indexOf(itemId);

    if (favoriteIndex === -1) {
      favoriteJobs.push(itemId);
      if (!companySubscriptionsData[user.id]) {
        companySubscriptionsData[user.id] = [];
      }
      const companyId = vacancy.companyUserId.toString();
      if (!companySubscriptionsData[user.id].includes(companyId)) {
        companySubscriptionsData[user.id].push(companyId);
        await fs.writeFile(COMPANY_SUBSCRIPTIONS_FILE, JSON.stringify(companySubscriptionsData, null, 2));
      }
    } else {
      favoriteJobs.splice(favoriteIndex, 1);
      const companyId = vacancy.companyUserId.toString();
      if (companySubscriptionsData[user.id]) {
        companySubscriptionsData[user.id] = companySubscriptionsData[user.id].filter(id => id !== companyId);
        if (companySubscriptionsData[user.id].length === 0) delete companySubscriptionsData[user.id];
        await fs.writeFile(COMPANY_SUBSCRIPTIONS_FILE, JSON.stringify(companySubscriptionsData, null, 2));
      }
    }

    await fs.writeFile(path.join(__dirname, "favoriteJobs.json"), JSON.stringify(favoriteJobs, null, 2));
    res.json({ success: true, favorites: favoriteJobs });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    releaseCompanySubs();
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

    res.json({ success: true });
  } catch (e) {
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
    res.status(500).json({ error: "Internal server error" });
  }
});

bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on("message:successful_payment", async (ctx) => {
  const release = await reviewsMutex.acquire();
  try {
    const payload = ctx.message.successful_payment.invoice_payload;

    if (!payload || !reviewsData[payload]) {
      await ctx.reply("Ошибка: не удалось обработать платеж. Обратитесь в поддержку.");
      return;
    }

    const { authorUserId, targetUserId, text } = reviewsData[payload];
    const reviewKey = `${authorUserId}_${Date.now()}`;
    reviewsData[reviewKey] = { text, authorUserId, targetUserId, date: new Date().toISOString() };
    delete reviewsData[payload];
    await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviewsData, null, 2));

    await ctx.reply("Отзыв опубликован! Спасибо!");

    try {
      const authorData = await bot.api.getChat(authorUserId);
      const authorUsername = authorData.username ? `@${authorData.username}` : "Неизвестный пользователь";
      const escapeMarkdownV2 = (str) => str.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1');
      const escapedText = escapeMarkdownV2(text);
      const escapedAuthorUsername = escapeMarkdownV2(authorUsername);
      const escapedDate = escapeMarkdownV2(new Date().toLocaleString());
      const message = `*Новый отзыв\\!*\n\n` +
                      `Пользователь *${escapedAuthorUsername}* оставил вам отзыв:\n` +
                      `> ${escapedText}\n\n` +
                      `Дата: ${escapedDate}`;
      await bot.api.sendMessage(targetUserId, message, { parse_mode: "MarkdownV2" });
    } catch (e) {}
  } catch (e) {
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
    }
  } catch (e) {}
  finally {
    release();
  }
}

setInterval(cleanOldTempReviews, 10 * 60 * 1000);

async function ensureLogsDir() {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  } catch (e) {}
}

Promise.all([
  ensureLogsDir(),
  initReviewsFile(),
  initJobsFile(),
  initSubscriptionsFile(),
  initVacanciesFile(),
  initCompanySubscriptionsFile()
])
  .then(async () => {
    await loadJobs();
    await loadReviews();
    await loadSubscriptions();
    await loadVacancies();
    await loadCompanySubscriptions();
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