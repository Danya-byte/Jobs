const { Bot } = require("grammy");
const { hydrateFiles } = require("@grammyjs/files");
const { InlineKeyboard } = require("grammy");
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
const { Mutex } = require("async-mutex");
const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const { v4: uuidv4 } = require('uuid');
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "7745513073:AAEAXKeJal-t0jcQ8U4MIby9DSSSvZ_TS90";
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
const ADMIN_IDS = ["1940359844"];

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
  origin: "https://jobs-iota-one.vercel.app",
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
async function migrateChatUnlocksData() {
  try {
    const rawData = await fs.readFile(CHAT_UNLOCKS_FILE, "utf8");
    const oldData = rawData.trim() ? JSON.parse(rawData) : {};
    const newData = { ...oldData };

    for (const [chatId, value] of Object.entries(oldData)) {
      const parts = chatId.split('_');
      if (parts.length !== 3) continue; // Пропускаем некорректные записи

      const [jobId, userId1, userId2] = parts;
      const mirrorChatId = `${jobId}_${userId2}_${userId1}`; // Зеркальное направление

      // Если зеркальной записи нет, создаем её
      if (!newData[mirrorChatId]) {
        newData[mirrorChatId] = { ...value };
      }
    }

    await fs.writeFile(CHAT_UNLOCKS_FILE, JSON.stringify(newData, null, 2));
    chatUnlocksData = newData;
    logger.info('Chat unlocks data migrated successfully for bidirectional blocking');
  } catch (error) {
    logger.error(`Error migrating chatUnlocksData: ${error.message}`);
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
    messagesData = Array.isArray(parsedData) ? parsedData : [];
  } catch {
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

    res.json({ success: true, job });
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
    const {
      companyUserId,
      companyName,
      position,
      description,
      requirements,
      tags,
      categories,
      contact,
      officialWebsite,
      verified,
      photoUrl,
    } = req.body;
    if (
      !companyUserId ||
      !companyName ||
      !position ||
      !description ||
      !requirements ||
      !tags ||
      !contact ||
      !officialWebsite ||
      !photoUrl
    ) {
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
      createdAt: new Date().toISOString(),
      pinned: false
    };
    vacanciesData.push(newVacancy);
    await fs.writeFile(VACANCIES_FILE, JSON.stringify(vacanciesData, null, 2));

    const subscribers = Object.entries(companySubscriptionsData)
      .filter(([_, companies]) => companies.includes(newVacancy.companyName))
      .map(([userId]) => userId);

    for (const subscriberId of subscribers) {
      try {
        await bot.api.sendMessage(
          subscriberId,
          `🏢 Компания "${newVacancy.companyName}" разместила новую вакансию:\n\n` +
            `📌 Позиция: ${newVacancy.position}\n` +
            `📝 Описание: ${newVacancy.description}\n` +
            `🔗 Контакт: ${newVacancy.contact}`
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

    const vacancy = vacanciesData.find((vacancy) => vacancy.id === vacancyId);
    if (!vacancy) {
      return res.status(404).json({ error: "Vacancy not found" });
    }

    vacancy.pinned = pinned;
    await fs.writeFile(VACANCIES_FILE, JSON.stringify(vacanciesData, null, 2));

    res.json({ success: true, vacancy });
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
    if (!title || !reward || !description || !contact) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newTask = {
      id: `${Date.now()}_${user.id}`,
      adminId: user.id,
      title,
      reward,
      deadline,
      description,
      tags: tags || [],
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

    const task = tasksData.find((task) => task.id === taskId);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    task.pinned = pinned;
    await fs.writeFile(TASKS_FILE, JSON.stringify(tasksData, null, 2));

    res.json({ success: true, task });
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
app.get("/api/reviews", async (req, res) => {
  try {
    const { targetUserId } = req.query; // Получаем targetUserId из query-параметров
    const telegramData = req.headers["x-telegram-data"];

    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!targetUserId) {
      return res.status(400).json({ error: "Параметр targetUserId обязателен" });
    }

    let reviews = {};
    try {
      const rawData = await fs.readFile(REVIEWS_FILE, "utf8");
      reviews = rawData.trim() ? JSON.parse(rawData) : {};
    } catch (error) {
      logger.error(`Ошибка чтения файла reviews.json: ${error.message}`);
      return res.status(500).json({ error: "Ошибка сервера при загрузке отзывов" });
    }

    const userReviews = Object.values(reviews).filter(
      (review) => review.targetUserId && review.targetUserId.toString() === targetUserId.toString()
    );

    res.json(userReviews);
  } catch (error) {
    logger.error(`Ошибка в /api/reviews: ${error.message}`);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
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
    reviewsData[payload] = {
      text,
      authorUserId: user.id,
      targetUserId,
      type: "review"
    };
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
  } catch {
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

    let firstName = "Unknown";
    let photoUrl = "https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp";

    try {
      const userData = await bot.api.getChat(userId);
      firstName = userData.first_name || "Unknown";
      photoUrl = userData.username
        ? `https://t.me/i/userpic/160/${userData.username}.jpg`
        : "https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp";
    } catch (telegramError) {
      logger.error(`Telegram API error for user ${userId}: ${telegramError.message}`);
    }

    const userJob = jobsData.find((job) => job.userId.toString() === userId);
    const userVacancy = vacanciesData.find((vacancy) => vacancy.companyUserId.toString() === userId);

    if (userJob) {
      firstName = userJob.firstName || firstName;
      if (userJob.username) {
        photoUrl = `https://t.me/i/userpic/160/${userJob.username}.jpg`;
      }
    } else if (userVacancy) {
      firstName = userVacancy.firstName || firstName;
      photoUrl = userVacancy.photoUrl || photoUrl;
    }

    return res.json({ firstName, photoUrl });
  } catch (error) {
    logger.error(`Ошибка в /api/user/${req.params.userId}: ${error.message}`);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});
app.get("/api/profile/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const telegramData = req.headers["x-telegram-data"];

    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userJob = jobsData.find((job) => job.userId.toString() === userId);
    const userVacancy = vacanciesData.find((vacancy) => vacancy.companyUserId.toString() === userId);
    let nick = "Unknown";
    let photoUrl = "https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp";

    if (userJob) {
      nick = userJob.nick;
      if (userJob.username) {
        photoUrl = `https://t.me/i/userpic/160/${userJob.username}.jpg`;
      }
    } else if (userVacancy) {
      nick = userVacancy.companyName;
      photoUrl = userVacancy.photoUrl;
    } else {
      try {
        const userData = await bot.api.getChat(userId);
        nick = userData.first_name || "Unknown";
        if (userData.username) {
          photoUrl = `https://t.me/i/userpic/160/${userData.username}.jpg`;
        }
      } catch {}
    }

    res.json({ nick, photoUrl });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/toggleFavorite", async (req, res) => {
  const releaseFreelancer = await freelancerSubscriptionsMutex.acquire();
  const releaseCompany = await companySubscriptionsMutex.acquire();
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

    const job = jobsData.find((j) => j.id === itemId);
    const vacancy = vacanciesData.find((v) => v.id === itemId);

    let favoriteJobs = [];
    try {
      favoriteJobs = JSON.parse(await fs.readFile(path.join(__dirname, "favoriteJobs.json"), "utf8") || "[]");
    } catch {
      favoriteJobs = [];
    }

    const favoriteIndex = favoriteJobs.indexOf(itemId);
    const userId = user.id.toString();

    if (favoriteIndex === -1) {
      favoriteJobs.push(itemId);

      if (vacancy) {
        if (!companySubscriptionsData[userId]) {
          companySubscriptionsData[userId] = [];
        }
        if (!companySubscriptionsData[userId].includes(vacancy.companyName)) {
          companySubscriptionsData[userId].push(vacancy.companyName);
          await fs.writeFile(COMPANY_SUBSCRIPTIONS_FILE, JSON.stringify(companySubscriptionsData, null, 2));
        }
      } else if (job) {
        if (!freelancerSubscriptionsData[userId]) {
          freelancerSubscriptionsData[userId] = [];
        }
        if (!freelancerSubscriptionsData[userId].includes(job.position)) {
          freelancerSubscriptionsData[userId].push(job.position);
          await fs.writeFile(FREELANCER_SUBSCRIPTIONS_FILE, JSON.stringify(freelancerSubscriptionsData, null, 2));
        }
      }
    } else {
      favoriteJobs.splice(favoriteIndex, 1);

      if (vacancy && companySubscriptionsData[userId]) {
        companySubscriptionsData[userId] = companySubscriptionsData[userId].filter(
          (name) => name !== vacancy.companyName
        );
        if (companySubscriptionsData[userId].length === 0) {
          delete companySubscriptionsData[userId];
        }
        await fs.writeFile(COMPANY_SUBSCRIPTIONS_FILE, JSON.stringify(companySubscriptionsData, null, 2));
      } else if (job && freelancerSubscriptionsData[userId]) {
        freelancerSubscriptionsData[userId] = freelancerSubscriptionsData[userId].filter(
          (pos) => pos !== job.position
        );
        if (freelancerSubscriptionsData[userId].length === 0) {
          delete freelancerSubscriptionsData[userId];
        }
        await fs.writeFile(FREELANCER_SUBSCRIPTIONS_FILE, JSON.stringify(freelancerSubscriptionsData, null, 2));
      }
    }

    await fs.writeFile(path.join(__dirname, "favoriteJobs.json"), JSON.stringify(favoriteJobs, null, 2));
    res.json({ success: true, favorites: favoriteJobs });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    releaseFreelancer();
    releaseCompany();
  }
});
app.get('/api/admin/chat/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const telegramData = req.headers['x-telegram-data'];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get('user') || '{}');

    if (!user.id || !ADMIN_IDS.includes(user.id.toString())) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [jobId, targetUserId] = chatId.split('_');
    if (!jobId || !targetUserId) {
      return res.status(400).json({ error: 'Invalid chatId format' });
    }

    const chatMessages = messagesData.filter(
      (msg) =>
        msg.jobId === jobId &&
        (msg.authorUserId.toString() === targetUserId || msg.targetUserId.toString() === targetUserId)
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (chatMessages.length === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const enrichedMessages = await Promise.all(chatMessages.map(async (msg) => {
      let authorName = 'Пользователь';
      let targetName = 'Пользователь';
      try {
        const authorData = await bot.api.getChat(msg.authorUserId);
        const targetData = await bot.api.getChat(msg.targetUserId);
        authorName = authorData.first_name || 'Пользователь';
        targetName = targetData.first_name || 'Пользователь';
      } catch (error) {}
      return {
        ...msg,
        authorName,
        targetName,
      };
    }));

    res.json(enrichedMessages);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.post('/api/report', async (req, res) => {
  const release = await messagesMutex.acquire();
  try {
    const { chatId, reason } = req.body;
    const telegramData = req.headers['x-telegram-data'];
    if (!telegramData) {
      return res.status(401).json({ error: 'Telegram data is required' });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get('user') || '{}');
    const reporterId = user.id.toString();
    const reporterName = user.first_name || 'Пользователь';
    const reporterUsername = user.username || 'без имени';

    const parts = chatId.split('_');
    let jobId, adminId, targetUserId;

    if (parts.length === 3) {
      [jobId, adminId, targetUserId] = parts;
    } else if (parts.length === 2) {
      [jobId, targetUserId] = parts;
      adminId = null;
    } else {
      return res.status(400).json({ error: 'Invalid chatId format' });
    }

    const chatIdDirection1 = `${jobId}_${reporterId}_${targetUserId}`; // A → B
    const chatIdDirection2 = `${jobId}_${targetUserId}_${reporterId}`; // B → A

    if (!chatUnlocksData[chatIdDirection1]) {
      chatUnlocksData[chatIdDirection1] = { blocked: true, reporterId };
    } else {
      chatUnlocksData[chatIdDirection1].blocked = true;
      chatUnlocksData[chatIdDirection1].reporterId = reporterId;
    }

    if (!chatUnlocksData[chatIdDirection2]) {
      chatUnlocksData[chatIdDirection2] = { blocked: true, reporterId };
    } else {
      chatUnlocksData[chatIdDirection2].blocked = true;
      chatUnlocksData[chatIdDirection2].reporterId = reporterId;
    }

    await fs.writeFile(CHAT_UNLOCKS_FILE, JSON.stringify(chatUnlocksData, null, 2));

    // Уведомление пользователей
    try {
      const user1Data = await bot.api.getChat(reporterId);
      const user2Data = await bot.api.getChat(targetUserId);
      const user1Name = user1Data.first_name || 'Пользователь';
      const user2Name = user2Data.first_name || 'Пользователь';

      await bot.api.sendMessage(reporterId, `Чат с ${user2Name} заблокирован до решения модерации.`);
      await bot.api.sendMessage(targetUserId, `Чат с ${user1Name} заблокирован до решения модерации.`);
    } catch (error) {
      logger.error(`Error notifying users about chat block: ${error.message}`);
    }

    // Уведомление админов
    let targetName = 'Пользователь';
    let targetUsername = 'без имени';
    try {
      const targetData = await bot.api.getChat(targetUserId);
      targetName = targetData.first_name || 'Пользователь';
      targetUsername = targetData.username || 'без имени';
    } catch (error) {
      logger.error(`Failed to get target user data for ${targetUserId}: ${error.message}`);
    }

    const message = `Пользователь ${reporterUsername} (${reporterName}) пожаловался на чат с ${targetUsername} (${targetName}) по причине: ${reason}`;
    const keyboard = new InlineKeyboard()
      .text('Посмотреть переписку', `view_${chatIdDirection1}`)
      .row()
      .text('Разблокировать', `unblock_${chatIdDirection1}`)
      .text('Удалить', `delete_${chatIdDirection1}`);

    for (const adminId of ADMIN_IDS) {
      try {
        await bot.api.sendMessage(adminId, message, { reply_markup: keyboard });
      } catch (error) {
        logger.error(`Failed to send report notification to admin ${adminId}: ${error.message}`);
      }
    }

    res.json({ success: true });
  } catch (error) {
    logger.error(`Error in /api/report: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    release();
  }
});
app.get('/api/chat/status/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const telegramData = req.headers['x-telegram-data'];
    if (!telegramData) {
      return res.status(401).json({ error: 'Telegram data is required' });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get('user') || '{}');
    const currentUserId = user.id.toString();

    const parts = chatId.split('_');
    if (parts.length !== 2) {
      return res.status(400).json({ error: 'Invalid chatId format' });
    }
    const [jobId, targetUserId] = parts;

    if (currentUserId !== targetUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const chatStatus = chatUnlocksData[chatId] || { blocked: false };
    res.json({ blocked: chatStatus.blocked });
  } catch (error) {
    logger.error(`Error in /api/chat/status: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.delete("/api/chat/:chatId", async (req, res) => {
  const release = await messagesMutex.acquire();
  try {
    const { chatId } = req.params;
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData) {
      return res.status(401).json({ error: "Telegram data is required" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");
    const currentUserId = user.id.toString();

    const parts = chatId.split('_');
    if (parts.length !== 2) {
      return res.status(400).json({ error: "Invalid chatId format" });
    }
    const [jobId, targetUserId] = parts;

    messagesData = messagesData.filter(msg =>
      !(msg.jobId === jobId &&
        ((msg.authorUserId === currentUserId && msg.targetUserId === targetUserId) ||
         (msg.authorUserId === targetUserId && msg.targetUserId === currentUserId)))
    );
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(messagesData, null, 2));

    let currentUserFirstName = user.first_name || "Пользователь";
    let otherUserFirstName = "Пользователь";
    try {
      const targetData = await bot.api.getChat(targetUserId);
      otherUserFirstName = targetData.first_name || "Пользователь";
    } catch (error) {
      console.error(`Failed to get chat for ${targetUserId}:`, error);
    }

    // Обновленные уведомления
    await bot.api.sendMessage(currentUserId, `Чат с ${otherUserFirstName} удалён вами`);
    await bot.api.sendMessage(targetUserId, `${currentUserFirstName} удалил с вами чат`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});
bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const adminId = ctx.from.id.toString();

  if (!ADMIN_IDS.includes(adminId)) {
    await ctx.answerCallbackQuery({ text: 'У вас нет прав для этого действия' });
    return;
  }

  let chatId;
  if (data.startsWith('unblock_')) {
    chatId = data.replace('unblock_', '');
  } else if (data.startsWith('delete_')) {
    chatId = data.replace('delete_', '');
  } else if (data.startsWith('view_')) {
    chatId = data.replace('view_', '');
  } else {
    return;
  }

  const release = await messagesMutex.acquire();
  try {
    if (!chatUnlocksData[chatId]) {
      await ctx.answerCallbackQuery({ text: 'Чат не найден' });
      return;
    }

    const parts = chatId.split('_');
    if (parts.length !== 3) {
      logger.error(`Invalid chatId format: ${chatId}`);
      await ctx.reply('Неверный формат chatId.');
      await ctx.answerCallbackQuery();
      return;
    }

    const [jobId, userId1, userId2] = parts;
    const chatIdDirection1 = `${jobId}_${userId1}_${userId2}`; // A → B
    const chatIdDirection2 = `${jobId}_${userId2}_${userId1}`; // B → A

    if (data.startsWith('view_')) {
      const reporterId = chatUnlocksData[chatId]?.reporterId?.toString();
      if (!reporterId) {
        logger.error(`Reporter ID not found for chatId: ${chatId}`);
        await ctx.reply('Репортёр не найден в данных чата.');
        await ctx.answerCallbackQuery();
        return;
      }

      logger.info(`Fetching messages for chatId: ${chatId}, reporterId: ${reporterId}, targetUserId: ${userId2}`);

      if (!Array.isArray(messagesData) || messagesData.length === 0) {
        logger.error(`messagesData is empty or not an array: ${JSON.stringify(messagesData)}`);
        await ctx.reply('Не удалось загрузить сообщения. Проверьте логи.');
        await ctx.answerCallbackQuery();
        return;
      }

      const chatMessages = messagesData.filter((msg) => {
        const msgJobIdBase = msg.jobId ? msg.jobId.split('_')[0] : '';
        const matchesJobId = msgJobIdBase === jobId;
        const msgAuthorId = msg.authorUserId.toString();
        const msgTargetId = msg.targetUserId.toString();
        const matchesUsers =
          (msgAuthorId === userId1 && msgTargetId === userId2) ||
          (msgAuthorId === userId2 && msgTargetId === userId1);
        return matchesJobId && matchesUsers;
      }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (chatMessages.length === 0) {
        logger.info(`No messages found for chatId: ${chatId}, jobId: ${jobId}, userId1: ${userId1}, userId2: ${userId2}, reporterId: ${reporterId}`);
        await ctx.reply('Переписка не найдена.');
        await ctx.answerCallbackQuery();
        return;
      }

      let messageText = `Переписка чата ${chatId}:\n\n`;
      for (const msg of chatMessages) {
        const authorData = await bot.api.getChat(msg.authorUserId);
        const authorName = authorData.first_name || 'Пользователь';
        messageText += `${authorName} (${msg.timestamp}): ${msg.text}\n`;
      }

      await ctx.reply(messageText.substring(0, 4096));
      await ctx.answerCallbackQuery({ text: 'Переписка показана' });
    } else if (data.startsWith('unblock_')) {
      // Разблокируем оба направления
      chatUnlocksData[chatIdDirection1].blocked = false;
      chatUnlocksData[chatIdDirection2].blocked = false;
      await fs.writeFile(CHAT_UNLOCKS_FILE, JSON.stringify(chatUnlocksData, null, 2));

      try {
        const user1Data = await bot.api.getChat(userId1);
        const user2Data = await bot.api.getChat(userId2);
        const user1Name = user1Data.first_name || 'Пользователь';
        const user2Name = user2Data.first_name || 'Пользователь';

        await bot.api.sendMessage(userId1, `Чат с ${user2Name} был разблокирован администратором`);
        await bot.api.sendMessage(userId2, `Чат с ${user1Name} был разблокирован администратором`);
      } catch (error) {
        logger.error(`Error notifying users for unblock: ${error.message}`);
      }

      await ctx.answerCallbackQuery({ text: 'Чат разблокирован' });
    } else if (data.startsWith('delete_')) {
      const reporterId = chatUnlocksData[chatId].reporterId;

      messagesData = messagesData.filter(
        (msg) => {
          const msgJobIdBase = msg.jobId ? msg.jobId.split('_')[0] : '';
          const matchesJobId = msgJobIdBase === jobId;
          const msgAuthorId = msg.authorUserId.toString();
          const msgTargetId = msg.targetUserId.toString();
          const matchesUsers =
            (msgAuthorId === userId1 && msgTargetId === userId2) ||
            (msgAuthorId === userId2 && msgTargetId === userId1);
          return !(matchesJobId && matchesUsers);
        }
      );
      await fs.writeFile(MESSAGES_FILE, JSON.stringify(messagesData, null, 2));

      // Удаляем оба направления
      delete chatUnlocksData[chatIdDirection1];
      delete chatUnlocksData[chatIdDirection2];
      await fs.writeFile(CHAT_UNLOCKS_FILE, JSON.stringify(chatUnlocksData, null, 2));

      try {
        const user1Data = await bot.api.getChat(userId1);
        const user2Data = await bot.api.getChat(userId2);
        const user1Name = user1Data.first_name || 'Пользователь';
        const user2Name = user2Data.first_name || 'Пользователь';

        await bot.api.sendMessage(userId1, `Чат с ${user2Name} был удалён администратором`);
        await bot.api.sendMessage(userId2, `Чат с ${user1Name} был удалён администратором`);
      } catch (error) {
        logger.error(`Error notifying users for delete: ${error.message}`);
      }

      await ctx.answerCallbackQuery({ text: 'Чат удалён' });
    }
  } catch (error) {
    logger.error(`Error processing callback query ${data}: ${error.message}`);
    await ctx.answerCallbackQuery({ text: 'Ошибка при обработке' });
  } finally {
    release();
  }
});
app.get("/api/messages/:chatUuid", async (req, res) => {
  try {
    const { chatUuid } = req.params;
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    const chat = chatUnlocksData[chatUuid];
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    const messages = messagesData
      .filter((msg) => msg.chatUuid === chatUuid)
      .map((msg) => ({
        ...msg,
        isSender: msg.authorUserId.toString() === user.id.toString(),
      }))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json(messages);
  } catch (error) {
    logger.error(`Error in /api/messages/:chatUuid: ${error.message}`);
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
    const { chatId, text } = req.body;

    const parts = chatId.split('_');
    if (parts.length !== 2) {
      return res.status(400).json({ error: "Invalid chatId format" });
    }
    const [jobId, targetUserId] = parts;

    if (!user?.id || !text) {
      return res.status(400).json({ error: "Invalid data" });
    }

    const job = jobsData.find((j) => j.id === jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.userId.toString() === user.id.toString()) {
      return res.status(400).json({ error: "Job owner can send messages for free" });
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
    logger.error(`Error in /api/createMessageInvoice: ${error.message}`);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.get("/api/chats", async (req, res) => {
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    const userMessages = messagesData.filter(
      (msg) => msg.authorUserId.toString() === user.id.toString() || msg.targetUserId.toString() === user.id.toString()
    );
    res.json(userMessages);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});
app.get('/api/chat/:targetUserId', async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const { jobId } = req.query;
    const telegramData = req.headers['x-telegram-data'];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get('user') || '{}');

    if (!jobId || !targetUserId) {
      return res.status(400).json({ error: 'Missing jobId or targetUserId' });
    }

    const jobIdBase = jobId.split('_')[0];

    const chatMessages = messagesData
      .filter(
        (msg) => {
          const msgJobIdBase = msg.jobId ? msg.jobId.split('_')[0] : null;
          const matchesJobId = !jobId || msg.jobId === jobId || msgJobIdBase === jobIdBase;
          return matchesJobId &&
            ((msg.authorUserId.toString() === user.id.toString() && msg.targetUserId.toString() === targetUserId) ||
             (msg.authorUserId.toString() === targetUserId && msg.targetUserId.toString() === user.id.toString()));
        }
      )
      .map((msg) => ({
        ...msg,
        isSender: msg.authorUserId.toString() === user.id.toString()
      }))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    logger.info(`Chat messages for user ${user.id}, target ${targetUserId}, jobId ${jobId}: ${JSON.stringify(chatMessages)}`);
    res.json(chatMessages);
  } catch (error) {
    logger.error(`Error in /api/chat/: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/chat/:targetUserId', async (req, res) => {
  const release = await messagesMutex.acquire();
  try {
    const { targetUserId } = req.params;
    const { text, jobId: rawJobId } = req.body;
    const telegramData = req.headers['x-telegram-data'];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get('user'));
    const authorUserId = user.id.toString();

    // Поиск или создание chatUuid
    let chatUuid = Object.keys(chatUnlocksData).find(key => {
      const chat = chatUnlocksData[key];
      return chat.jobId === rawJobId &&
             ((chat.authorUserId === authorUserId && chat.targetUserId === targetUserId) ||
              (chat.authorUserId === targetUserId && chat.targetUserId === authorUserId));
    });

    if (!chatUuid) {
      chatUuid = uuidv4();
      chatUnlocksData[chatUuid] = {
        jobId: rawJobId,
        authorUserId,
        targetUserId,
        blocked: false
      };
      await fs.writeFile(CHAT_UNLOCKS_FILE, JSON.stringify(chatUnlocksData, null, 2));
    }

    if (chatUnlocksData[chatUuid].blocked) {
      return res.status(403).json({ error: 'Chat is blocked' });
    }

    const message = {
      id: `${authorUserId}_${Date.now()}`,
      text,
      authorUserId,
      targetUserId,
      jobId: rawJobId,
      timestamp: new Date().toISOString(),
      chatUuid
    };

    messagesData.push(message);
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(messagesData, null, 2));

    // Уведомление
    try {
      const targetData = await bot.api.getChat(targetUserId);
      const escapeMarkdownV2 = (str) => str.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1');
      const notification =
        `*New Message\\!*\n\n` +
        `User *${escapeMarkdownV2(user.first_name || 'Unknown')}* sent you a message:\n` +
        `> ${escapeMarkdownV2(text)}\n\n` +
        `Date: ${escapeMarkdownV2(new Date().toLocaleString())}`;
      const keyboard = new InlineKeyboard().webApp(
        '💬 Open Chat',
        `https://jobs-iota-one.vercel.app/chat/${chatUuid}`
      );
      await bot.api.sendMessage(targetUserId, notification, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard
      });
    } catch (error) {
      logger.error(`Failed to notify target user ${targetUserId}: ${error.message}`);
    }

    res.json({ success: true, chatUuid, message });
  } catch (error) {
    logger.error(`Error in /api/chat/:targetUserId: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    release();
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
  } catch {
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
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on("message:successful_payment", async (ctx) => {
  const releaseMessages = await messagesMutex.acquire();
  const releaseReviews = await reviewsMutex.acquire();
  try {
    const payload = ctx.message.successful_payment.invoice_payload;

    if (!payload) {
      await ctx.reply("Error: Unable to process payment. Contact support.");
      return;
    }

    const pendingMessage = pendingMessagesData[payload];
    const pendingReview = reviewsData[payload];

    if (pendingMessage && pendingMessage.type === "message") {
      const { authorUserId, targetUserId, text, jobId } = pendingMessage;
      const message = {
        id: `${authorUserId}_${Date.now()}`,
        text,
        authorUserId,
        targetUserId,
        jobId,
        timestamp: new Date().toISOString(),
        isSender: true
      };

      if (!Array.isArray(messagesData)) {
        messagesData = [];
      }

      messagesData.push(message);
      await fs.writeFile(MESSAGES_FILE, JSON.stringify(messagesData, null, 2));
      delete pendingMessagesData[payload];
      await fs.writeFile(PENDING_MESSAGES_FILE, JSON.stringify(pendingMessagesData, null, 2));

      await ctx.reply("Message sent to freelancer! Thank you!");

      try {
        const authorData = await bot.api.getChat(authorUserId);
        const targetData = await bot.api.getChat(targetUserId);
        const escapeMarkdownV2 = (str) => str.replace(/([_*[\]()~`>#+=|{}.!-])/g, "\\$1");

        const notification =
          `*New Message\\!*\n\n` +
          `User *${escapeMarkdownV2(authorData.first_name || "Unknown")}* sent you a message:\n` +
          `> ${escapeMarkdownV2(text)}\n\n` +
          `Date: ${escapeMarkdownV2(new Date().toLocaleString())}`;

        const keyboard = new InlineKeyboard().webApp(
          "💬 Open Chat",
          `https://jobs-iota-one.vercel.app/chat/${jobId}_${authorUserId}`
        );

        await bot.api.sendMessage(
          targetUserId,
          notification,
          {
            parse_mode: "MarkdownV2",
            reply_markup: keyboard
          }
        );
      } catch (error) {
        logger.error(`Failed to notify target user ${targetUserId}: ${error.message}`);
      }
    } else if (pendingReview && pendingReview.type === "review") {
      const { text, authorUserId, targetUserId } = pendingReview;
      const review = {
        id: `${authorUserId}_${Date.now()}`,
        text,
        authorUserId,
        targetUserId,
        date: new Date().toISOString()
      };

      reviewsData[review.id] = review;
      delete reviewsData[payload];
      await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviewsData, null, 2));

      await ctx.reply("Review submitted successfully! Thank you!");

      try {
        const authorData = await bot.api.getChat(authorUserId);
        const escapeMarkdownV2 = (str) => str.replace(/([_*[\]()~`>#+=|{}.!-])/g, "\\$1");

        const keyboard = new InlineKeyboard()
          .webApp(
            "👤 View profile",
            `https://jobs-iota-one.vercel.app/profile/${targetUserId}`
          );

        const notification =
          `*New Review\\!*\n\n` +
          `User *${escapeMarkdownV2(authorData.first_name || "Unknown")}* left you a review:\n` +
          `> ${escapeMarkdownV2(text)}\n\n` +
          `Date: ${escapeMarkdownV2(new Date().toLocaleString())}`;

        await bot.api.sendMessage(
          targetUserId,
          notification,
          {
            parse_mode: "MarkdownV2",
            reply_markup: keyboard
          }
        );
      } catch {}
    } else {
      await ctx.reply("Error: Payment data not found.");
    }
  } catch (error) {
    logger.error(`Error processing payment: ${error.message}`);
    await ctx.reply("Error processing payment.");
  } finally {
    releaseMessages();
    releaseReviews();
  }
});

async function cleanOldTempMessages() {
  const release = await messagesMutex.acquire();
  try {
    const now = Date.now();
    let cleanedCount = 0;
    for (const [key, message] of Object.entries(pendingMessagesData)) {
      if (now - parseInt(key.split("_")[1]) > 60 * 60 * 1000) {
        delete pendingMessagesData[key];
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      await fs.writeFile(PENDING_MESSAGES_FILE, JSON.stringify(pendingMessagesData, null, 2));
    }
  } catch {} finally {
    release();
  }
}

setInterval(cleanOldTempMessages, 10 * 60 * 1000);

async function ensureLogsDir() {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  } catch {}
}
app.use((req, res, next) => {
  logger.warn(`Маршрут не найден: ${req.method} ${req.path}`);
  res.status(404).json({ error: "Ресурс не найден" });
});

app.use((err, req, res, next) => {
  logger.error(`Необработанная ошибка: ${err.stack}`);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});



Promise.all([
  ensureLogsDir(),
  initReviewsFile(),
  initMessagesFile(),
  initJobsFile(),
  initFreelancerSubscriptionsFile(),
  initVacanciesFile(),
  initTasksFile(),
  initCompanySubscriptionsFile(),
  initChatUnlocksFile(),
  initPendingMessagesFile(),
])
  .then(async () => {
    await loadJobs();
    await loadReviews();
    await loadMessages();
    await loadFreelancerSubscriptions();
    await loadVacancies();
    await loadTasks();
    await loadCompanySubscriptions();
    await loadChatUnlocks();
    await migrateChatUnlocksData(); // Добавляем миграцию
    await loadPendingMessages();
    app.listen(port, () => {
      bot.start();
      logger.info(`Server running on port ${port}`);
    });
  })
  .catch(() => {
    logger.error(`Failed to start server`);
    process.exit(1);
  });

process.on("uncaughtException", (err) => logger.error(`Uncaught Exception: ${err.message}`));
process.on("unhandledRejection", (reason) => logger.error(`Unhandled Rejection: ${reason}`));