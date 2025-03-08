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
const MESSAGES_FILE = path.join(__dirname, "messages.json");
const JOBS_FILE = path.join(__dirname, "jobs.json");
const FREELANCER_SUBSCRIPTIONS_FILE = path.join(__dirname, "subscriptions.json");
const VACANCIES_FILE = path.join(__dirname, "vacancies.json");
const COMPANY_SUBSCRIPTIONS_FILE = path.join(__dirname, "companySubscriptions.json");
const TASKS_FILE = path.join(__dirname, "tasks.json");
const CHAT_UNLOCKS_FILE = path.join(__dirname, "chatUnlocks.json");
const PENDING_MESSAGES_FILE = path.join(__dirname, "pendingMessages.json");
const LOGS_DIR = path.join(__dirname, "logs");
const ADMIN_IDS = ["1029594875", "1871247390", "1940359844", "6629517298", "6568279325", "5531474912", "6153316854"];

const jobsMutex = new Mutex();
const reviewsMutex = new Mutex();
const messagesMutex = new Mutex();
const freelancerSubscriptionsMutex = new Mutex();
const vacanciesMutex = new Mutex();
const companySubscriptionsMutex = new Mutex();
const tasksMutex = new Mutex();

let jobsData = [];
let reviewsData = {};
let messagesData = [];
let freelancerSubscriptionsData = {};
let vacanciesData = [];
let companySubscriptionsData = [];
let tasksData = [];
let chatUnlocksData = {};
let pendingMessagesData = {};

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

async function initMessagesFile() {
  try {
    await fs.access(MESSAGES_FILE);
    const data = await fs.readFile(MESSAGES_FILE, "utf8");
    if (!data.trim()) await fs.writeFile(MESSAGES_FILE, "[]");
  } catch {
    await fs.writeFile(MESSAGES_FILE, "[]");
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

async function initFreelancerSubscriptionsFile() {
  try {
    await fs.access(FREELANCER_SUBSCRIPTIONS_FILE);
    const data = await fs.readFile(FREELANCER_SUBSCRIPTIONS_FILE, "utf8");
    if (!data.trim()) await fs.writeFile(FREELANCER_SUBSCRIPTIONS_FILE, "{}");
  } catch {
    await fs.writeFile(FREELANCER_SUBSCRIPTIONS_FILE, "{}");
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

async function initTasksFile() {
  try {
    await fs.access(TASKS_FILE);
    const data = await fs.readFile(TASKS_FILE, "utf8");
    if (!data.trim()) await fs.writeFile(TASKS_FILE, "[]");
  } catch {
    await fs.writeFile(TASKS_FILE, "[]");
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

async function initChatUnlocksFile() {
  try {
    await fs.access(CHAT_UNLOCKS_FILE);
    const data = await fs.readFile(CHAT_UNLOCKS_FILE, "utf8");
    if (!data.trim()) await fs.writeFile(CHAT_UNLOCKS_FILE, "{}");
  } catch {
    await fs.writeFile(CHAT_UNLOCKS_FILE, "{}");
  }
}

async function initPendingMessagesFile() {
  try {
    await fs.access(PENDING_MESSAGES_FILE);
    const data = await fs.readFile(PENDING_MESSAGES_FILE, "utf8");
    if (!data.trim()) await fs.writeFile(PENDING_MESSAGES_FILE, "{}");
  } catch {
    await fs.writeFile(PENDING_MESSAGES_FILE, "{}");
  }
}

async function loadJobs() {
  try {
    const rawData = await fs.readFile(JOBS_FILE, "utf8");
    jobsData = rawData.trim() ? JSON.parse(rawData) : [];
  } catch {
    jobsData = [];
  }
}

async function loadReviews() {
  try {
    const rawData = await fs.readFile(REVIEWS_FILE, "utf8");
    reviewsData = rawData.trim() ? JSON.parse(rawData) : {};
  } catch {
    reviewsData = {};
  }
}

async function loadMessages() {
  try {
    const rawData = await fs.readFile(MESSAGES_FILE, "utf8");
    const parsedData = rawData.trim() ? JSON.parse(rawData) : [];
    if (!Array.isArray(parsedData)) {
      console.error("Data in messages.json is not an array, resetting to empty array.");
      messagesData = [];
    } else {
      messagesData = parsedData;
    }
  } catch (error) {
    console.error("Error loading messages:", error);
    messagesData = [];
  }
}

async function loadFreelancerSubscriptions() {
  try {
    const rawData = await fs.readFile(FREELANCER_SUBSCRIPTIONS_FILE, "utf8");
    freelancerSubscriptionsData = rawData.trim() ? JSON.parse(rawData) : {};
  } catch {
    freelancerSubscriptionsData = {};
  }
}

async function loadVacancies() {
  try {
    const rawData = await fs.readFile(VACANCIES_FILE, "utf8");
    vacanciesData = rawData.trim() ? JSON.parse(rawData) : [];
  } catch {
    vacanciesData = [];
  }
}

async function loadTasks() {
  try {
    const rawData = await fs.readFile(TASKS_FILE, "utf8");
    tasksData = rawData.trim() ? JSON.parse(rawData) : [];
  } catch {
    tasksData = [];
  }
}

async function loadCompanySubscriptions() {
  try {
    const rawData = await fs.readFile(COMPANY_SUBSCRIPTIONS_FILE, "utf8");
    companySubscriptionsData = rawData.trim() ? JSON.parse(rawData) : {};
  } catch {
    companySubscriptionsData = {};
  }
}

async function loadChatUnlocks() {
  try {
    const rawData = await fs.readFile(CHAT_UNLOCKS_FILE, "utf8");
    chatUnlocksData = rawData.trim() ? JSON.parse(rawData) : {};
  } catch {
    chatUnlocksData = {};
  }
}

async function loadPendingMessages() {
  try {
    const rawData = await fs.readFile(PENDING_MESSAGES_FILE, "utf8");
    pendingMessagesData = rawData.trim() ? JSON.parse(rawData) : {};
  } catch {
    pendingMessagesData = {};
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
  } catch {
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
      createdAt: new Date().toISOString(),
      pinned: false
    };

    jobsData.push(newJob);
    await fs.writeFile(JOBS_FILE, JSON.stringify(jobsData, null, 2));

    const subscribers = Object.entries(freelancerSubscriptionsData)
      .filter(([_, positions]) => positions.includes(newJob.position))
      .map(([userId]) => userId);

    for (const subscriberId of subscribers) {
      try {
        await bot.api.sendMessage(
          subscriberId,
          `🎉 Новый фрилансер на позицию "${newJob.position}":\n\n` +
            `📝 Описание: ${newJob.description}\n` +
            `🔗 Контакт: ${newJob.contact}`
        );
      } catch {}
    }

    res.json({ success: true, job: newJob });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.put("/api/jobs/:jobId/pinned", async (req, res) => {
  const release = await jobsMutex.acquire();
  try {
    const { jobId } = req.params;
    const { pinned } = req.body;
    const telegramData = req.headers["x-telegram-data"];

    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    if (!user.id || !ADMIN_IDS.includes(user.id.toString())) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const job = jobsData.find((job) => job.id === jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    job.pinned = pinned;
    await fs.writeFile(JOBS_FILE, JSON.stringify(jobsData, null, 2));

    res.json({ success: true });
  } catch {
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
  } catch {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.get("/api/reviews/:userId", async (req, res) => {
  const { userId } = req.params;
  res.json(reviewsData[userId] || []);
});

app.post("/api/reviews", async (req, res) => {
  const release = await reviewsMutex.acquire();
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    const { targetUserId, text, rating } = req.body;
    if (!user.id || !targetUserId || !text || !rating) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newReview = {
      id: `${Date.now()}_${user.id}`,
      authorUserId: user.id,
      targetUserId,
      text,
      rating,
      createdAt: new Date().toISOString(),
    };

    if (!reviewsData[targetUserId]) reviewsData[targetUserId] = [];
    reviewsData[targetUserId].push(newReview);
    await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviewsData, null, 2));

    res.json({ success: true, review: newReview });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.get("/api/messages/:userId/:targetUserId", async (req, res) => {
  try {
    const { userId, targetUserId } = req.params;
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");
    if (user.id.toString() !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const userMessages = messagesData.filter(
      (msg) =>
        (msg.authorUserId === userId && msg.targetUserId === targetUserId) ||
        (msg.authorUserId === targetUserId && msg.targetUserId === userId)
    );

    res.json({ messages: userMessages });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/owner-chats/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");
    if (user.id.toString() !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const userMessages = messagesData.filter(
      (msg) => msg.authorUserId === userId || msg.targetUserId === userId
    );
    const enrichedMessages = await Promise.all(userMessages.map(async (msg) => {
      try {
        const authorData = await bot.api.getChat(msg.authorUserId);
        return {
          ...msg,
          authorName: authorData.first_name || 'Unknown',
          authorUsername: authorData.username || ''
        };
      } catch {
        return { ...msg, authorName: 'Unknown', authorUsername: '' };
      }
    }));
    res.json({ messages: enrichedMessages });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/createMessageInvoice", async (req, res) => {
  const release = await messagesMutex.acquire();
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user"));
    const { targetUserId, text, jobId } = req.body;

    if (!user?.id || !targetUserId || !text) {
      return res.status(400).json({ error: "Invalid data" });
    }

    const job = jobsData.find(j => j.id === jobId);
    if (job && job.userId.toString() === user.id.toString()) {
      const message = {
        id: `${user.id}_${Date.now()}`,
        text,
        authorUserId: user.id,
        targetUserId,
        jobId,
        timestamp: new Date().toISOString(),
        isSender: true
      };
      messagesData.push(message);
      await fs.writeFile(MESSAGES_FILE, JSON.stringify(messagesData, null, 2));

      const authorData = await bot.api.getChat(user.id);
      const targetData = await bot.api.getChat(targetUserId);
      const authorUsername = authorData.username ? `@${authorData.username}` : "Неизвестный пользователь";
      const escapeMarkdownV2 = (str) => str.replace(/([_*[\]()~`>#+=|{}.!-])/g, "\\$1");
      const escapedText = escapeMarkdownV2(text);
      const escapedAuthorUsername = escapeMarkdownV2(authorUsername);
      const escapedDate = escapeMarkdownV2(new Date().toLocaleString());
      const notification =
        `*Новое сообщение\\!*\n\n` +
        `Пользователь *${escapedAuthorUsername}* отправил вам сообщение:\n` +
        `> ${escapedText}\n\n` +
        `Дата: ${escapedDate}\n` +
        `[Открыть чат](https://t.me/${targetData.username || 'workiks_admin'}?start=chat_${user.id})`;
      await bot.api.sendMessage(targetUserId, notification, { parse_mode: "MarkdownV2" });

      return res.json({ success: true, message: "Message sent without payment" });
    }

    const payload = `${user.id}_${Date.now()}`;
    pendingMessagesData[payload] = { text, authorUserId: user.id, targetUserId, jobId, type: "message" };
    await fs.writeFile(PENDING_MESSAGES_FILE, JSON.stringify(pendingMessagesData, null, 2));

    const invoiceLink = await bot.api.createInvoiceLink(
      "Send a Message",
      "Pay 1 Telegram Star to send a message to the freelancer",
      payload,
      "",
      "XTR",
      [{ label: "Message Sending", amount: 1 }]
    );

    res.json({ success: true, invoiceLink });
  } catch (error) {
    console.error("Error creating message invoice:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.post("/api/subscribe", async (req, res) => {
  const release = await freelancerSubscriptionsMutex.acquire();
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");
    const { positions } = req.body;

    if (!user.id || !positions || !Array.isArray(positions)) {
      return res.status(400).json({ error: "Invalid data" });
    }

    freelancerSubscriptionsData[user.id] = positions;
    await fs.writeFile(FREELANCER_SUBSCRIPTIONS_FILE, JSON.stringify(freelancerSubscriptionsData, null, 2));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.get("/api/subscriptions/:userId", async (req, res) => {
  const { userId } = req.params;
  const telegramData = req.headers["x-telegram-data"];
  if (!telegramData || !validateTelegramData(telegramData)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const params = new URLSearchParams(telegramData);
  const user = JSON.parse(params.get("user") || "{}");

  if (user.id.toString() !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  res.json({ positions: freelancerSubscriptionsData[userId] || [] });
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

    const { companyUserId, companyName, position, description, requirements, tags, categories, contact, officialWebsite, photoUrl, verified } = req.body;

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
      photoUrl,
      verified: verified || false,
      createdAt: new Date().toISOString(),
      pinned: false
    };

    vacanciesData.push(newVacancy);
    await fs.writeFile(VACANCIES_FILE, JSON.stringify(vacanciesData, null, 2));

    const subscribers = Object.entries(companySubscriptionsData)
      .filter(([_, companyIds]) => companyIds.includes(companyUserId))
      .map(([userId]) => userId);

    for (const subscriberId of subscribers) {
      try {
        await bot.api.sendMessage(
          subscriberId,
          `🎉 Новая вакансия от ${companyName} на позицию "${position}":\n\n` +
            `📝 Описание: ${description}\n` +
            `🔗 Контакт: ${contact}\n` +
            `🌐 Веб-сайт: ${officialWebsite}`
        );
      } catch {}
    }

    res.json({ success: true, vacancy: newVacancy });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.put("/api/vacancies/:vacancyId/pinned", async (req, res) => {
  const release = await vacanciesMutex.acquire();
  try {
    const { vacancyId } = req.params;
    const { pinned } = req.body;
    const telegramData = req.headers["x-telegram-data"];

    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    if (!user.id || !ADMIN_IDS.includes(user.id.toString())) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const vacancy = vacanciesData.find((v) => v.id === vacancyId);
    if (!vacancy) {
      return res.status(404).json({ error: "Vacancy not found" });
    }

    vacancy.pinned = pinned;
    await fs.writeFile(VACANCIES_FILE, JSON.stringify(vacanciesData, null, 2));

    res.json({ success: true });
  } catch {
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
  } catch {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.get("/api/tasks", async (req, res) => {
  res.json(tasksData);
});

app.post("/api/tasks", async (req, res) => {
  const release = await tasksMutex.acquire();
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

    const { title, reward, deadline, description, tags, categories, contact, photoUrl } = req.body;

    if (!title || !reward || !description || !tags || !contact) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newTask = {
      id: `${Date.now()}_${user.id}`,
      adminId: user.id,
      title,
      reward,
      deadline: deadline || null,
      description,
      tags,
      categories: categories || [],
      contact,
      photoUrl: photoUrl || "",
      createdAt: new Date().toISOString(),
      pinned: false
    };

    tasksData.push(newTask);
    await fs.writeFile(TASKS_FILE, JSON.stringify(tasksData, null, 2));
    res.json({ success: true, task: newTask });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.put("/api/tasks/:taskId/pinned", async (req, res) => {
  const release = await tasksMutex.acquire();
  try {
    const { taskId } = req.params;
    const { pinned } = req.body;
    const telegramData = req.headers["x-telegram-data"];

    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    if (!user.id || !ADMIN_IDS.includes(user.id.toString())) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const task = tasksData.find((t) => t.id === taskId);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    task.pinned = pinned;
    await fs.writeFile(TASKS_FILE, JSON.stringify(tasksData, null, 2));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.delete("/api/tasks/:taskId", async (req, res) => {
  const release = await tasksMutex.acquire();
  try {
    const { taskId } = req.params;
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    if (!user.id || !ADMIN_IDS.includes(user.id.toString())) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const taskIndex = tasksData.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
      return res.status(404).json({ error: "Task not found" });
    }

    tasksData.splice(taskIndex, 1);
    await fs.writeFile(TASKS_FILE, JSON.stringify(tasksData, null, 2));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.post("/api/companySubscribe", async (req, res) => {
  const release = await companySubscriptionsMutex.acquire();
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");
    const { companyIds } = req.body;

    if (!user.id || !companyIds || !Array.isArray(companyIds)) {
      return res.status(400).json({ error: "Invalid data" });
    }

    companySubscriptionsData[user.id] = companyIds;
    await fs.writeFile(COMPANY_SUBSCRIPTIONS_FILE, JSON.stringify(companySubscriptionsData, null, 2));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.get("/api/companySubscriptions/:userId", async (req, res) => {
  const { userId } = req.params;
  const telegramData = req.headers["x-telegram-data"];
  if (!telegramData || !validateTelegramData(telegramData)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const params = new URLSearchParams(telegramData);
  const user = JSON.parse(params.get("user") || "{}");

  if (user.id.toString() !== userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  res.json({ companyIds: companySubscriptionsData[userId] || [] });
});

app.post("/api/toggleFavorite", async (req, res) => {
  const release = await freelancerSubscriptionsMutex.acquire();
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");
    const { itemId } = req.body;

    if (!user.id || !itemId) {
      return res.status(400).json({ error: "Invalid data" });
    }

    const isVacancy = vacanciesData.some(v => v.id === itemId);
    const dataKey = isVacancy ? companySubscriptionsData : freelancerSubscriptionsData;
    const fileKey = isVacancy ? COMPANY_SUBSCRIPTIONS_FILE : FREELANCER_SUBSCRIPTIONS_FILE;
    const key = isVacancy ? "companyIds" : "positions";

    if (!dataKey[user.id]) dataKey[user.id] = [];
    const index = dataKey[user.id].indexOf(itemId);

    if (index === -1) {
      dataKey[user.id].push(itemId);
    } else {
      dataKey[user.id].splice(index, 1);
    }

    await fs.writeFile(fileKey, JSON.stringify(dataKey, null, 2));
    res.json({ success: true, favorites: dataKey[user.id] });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.get("/api/favorites", async (req, res) => {
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    const freelancerFavorites = freelancerSubscriptionsData[user.id] || [];
    const companyFavorites = companySubscriptionsData[user.id] || [];
    const favorites = [...freelancerFavorites, ...companyFavorites];

    res.json(favorites);
  } catch {
    res.status(500).json({ error: "Internal server error" });
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

    const isAdmin = ADMIN_IDS.includes(user.id.toString());
    res.json({ isAdmin });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

bot.on("pre_checkout_query", async (ctx) => {
  try {
    await ctx.answerPreCheckoutQuery(true);
  } catch (error) {
    console.error("Error answering pre-checkout query:", error);
  }
});

bot.on("message:successful_payment", async (ctx) => {
  const release = await messagesMutex.acquire();
  try {
    const payment = ctx.message.successful_payment;
    const payload = payment.provider_payment_charge_id;

    const pendingMessage = pendingMessagesData[payload];
    if (!pendingMessage) {
      return;
    }

    const { text, authorUserId, targetUserId, jobId } = pendingMessage;

    const message = {
      id: `${authorUserId}_${Date.now()}`,
      text,
      authorUserId,
      targetUserId,
      jobId,
      timestamp: new Date().toISOString(),
      isSender: true,
    };

    messagesData.push(message);
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(messagesData, null, 2));

    delete pendingMessagesData[payload];
    await fs.writeFile(PENDING_MESSAGES_FILE, JSON.stringify(pendingMessagesData, null, 2));

    const authorData = await bot.api.getChat(authorUserId);
    const targetData = await bot.api.getChat(targetUserId);
    const authorUsername = authorData.username ? `@${authorData.username}` : "Неизвестный пользователь";

    const escapeMarkdownV2 = (str) => str.replace(/([_*[\]()~`>#+=|{}.!-])/g, "\\$1");
    const escapedText = escapeMarkdownV2(text);
    const escapedAuthorUsername = escapeMarkdownV2(authorUsername);
    const escapedDate = escapeMarkdownV2(new Date().toLocaleString());

    const notification =
      `*Новое сообщение\\!*\n\n` +
      `Пользователь *${escapedAuthorUsername}* отправил вам сообщение:\n` +
      `> ${escapedText}\n\n` +
      `Дата: ${escapedDate}\n` +
      `[Открыть чат](https://t.me/${targetData.username || 'workiks_admin'}?start=chat_${authorUserId})`;

    await bot.api.sendMessage(targetUserId, notification, { parse_mode: "MarkdownV2" });
  } catch (error) {
    console.error("Error handling successful payment:", error);
  } finally {
    release();
  }
});

Promise.all([
  initReviewsFile(),
  initMessagesFile(),
  initJobsFile(),
  initFreelancerSubscriptionsFile(),
  initVacanciesFile(),
  initCompanySubscriptionsFile(),
  initTasksFile(),
  initChatUnlocksFile(),
  initPendingMessagesFile(),
]).then(() =>
  Promise.all([
    loadReviews(),
    loadMessages(),
    loadJobs(),
    loadFreelancerSubscriptions(),
    loadVacancies(),
    loadCompanySubscriptions(),
    loadTasks(),
    loadChatUnlocks(),
    loadPendingMessages(),
  ])
).then(() => {
  bot.start();
  app.listen(port, () => console.log(`Server running on port ${port}`));
}).catch((error) => console.error("Initialization error:", error));