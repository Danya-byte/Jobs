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
const FREELANCER_SUBSCRIPTIONS_FILE = path.join(__dirname, "subscriptions.json");
const VACANCIES_FILE = path.join(__dirname, "vacancies.json");
const COMPANY_SUBSCRIPTIONS_FILE = path.join(__dirname, "companySubscriptions.json");
const TASKS_FILE = path.join(__dirname, "tasks.json");
const CHATS_FILE = path.join(__dirname, "chats.json");
const LOGS_DIR = path.join(__dirname, "logs");
const ADMIN_IDS = ["1029594875", "1871247390", "1940359844", "6629517298", "6568279325", "5531474912", "6153316854"];

const jobsMutex = new Mutex();
const reviewsMutex = new Mutex();
const freelancerSubscriptionsMutex = new Mutex();
const vacanciesMutex = new Mutex();
const companySubscriptionsMutex = new Mutex();
const tasksMutex = new Mutex();
const chatsMutex = new Mutex();

let jobsData = [];
let reviewsData = {};
let freelancerSubscriptionsData = {};
let vacanciesData = [];
let companySubscriptionsData = [];
let tasksData = [];
let chatsData = {};

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

async function initChatsFile() {
  try {
    await fs.access(CHATS_FILE);
    const data = await fs.readFile(CHATS_FILE, "utf8");
    if (!data.trim()) await fs.writeFile(CHATS_FILE, "{}");
  } catch {
    await fs.writeFile(CHATS_FILE, "{}");
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

async function loadFreelancerSubscriptions() {
  try {
    const rawData = await fs.readFile(FREELANCER_SUBSCRIPTIONS_FILE, "utf8");
    freelancerSubscriptionsData = rawData.trim() ? JSON.parse(rawData) : {};
  } catch (e) {
    freelancerSubscriptionsData = {};
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

async function loadTasks() {
  try {
    const rawData = await fs.readFile(TASKS_FILE, "utf8");
    tasksData = rawData.trim() ? JSON.parse(rawData) : [];
  } catch (e) {
    tasksData = [];
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

async function loadChats() {
  try {
    const rawData = await fs.readFile(CHATS_FILE, "utf8");
    chatsData = rawData.trim() ? JSON.parse(rawData) : {};
  } catch (e) {
    chatsData = {};
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
      createdAt: new Date().toISOString(),
      pinned: false
    };

    jobsData.push(newJob);
    await fs.writeFile(JOBS_FILE, JSON.stringify(jobsData, null, 2));

    const subscribers = Object.entries(freelancerSubscriptionsData)
      .filter(([_, positions]) => positions.includes(newJob.position))
      .map(([userId]) => userId);

    logger.info(`Found ${subscribers.length} subscribers for position "${newJob.position}": ${subscribers.join(", ")}`);

    for (const subscriberId of subscribers) {
      try {
        await bot.api.sendMessage(
          subscriberId,
          `🎉 Новый фрилансер на позицию "${newJob.position}":\n\n` +
            `📝 Описание: ${newJob.description}\n` +
            `🔗 Контакт: ${newJob.contact}`
        );
        logger.info(`Notified user ${subscriberId} about new job on position "${newJob.position}"`);
      } catch (e) {
        logger.error(`Failed to notify user ${subscriberId}: ${e.message}`);
      }
    }

    res.json({ success: true, job: newJob });
  } catch (e) {
    logger.error(`Error in POST /api/jobs: ${e.message}`);
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
      verified: !!verified,
      photoUrl,
      createdAt: new Date().toISOString(),
      pinned: false,
    };

    vacanciesData.push(newVacancy);
    await fs.writeFile(VACANCIES_FILE, JSON.stringify(vacanciesData, null, 2));

    const subscribers = Object.entries(companySubscriptionsData)
      .filter(([_, companyIds]) => companyIds.includes(companyUserId))
      .map(([userId]) => userId);

    logger.info(`Found ${subscribers.length} subscribers for company ID "${companyUserId}": ${subscribers.join(", ")}`);

    for (const subscriberId of subscribers) {
      try {
        await bot.api.sendMessage(
          subscriberId,
          `🎉 Новая вакансия от компании "${newVacancy.companyName}":\n\n` +
            `📝 Должность: ${newVacancy.position}\n` +
            `ℹ️ Описание: ${newVacancy.description}\n` +
            `🔗 Контакт: ${newVacancy.contact}\n` +
            `🌐 Веб-сайт: ${newVacancy.officialWebsite}`
        );
        logger.info(`Notified user ${subscriberId} about new vacancy from company "${newVacancy.companyName}"`);
      } catch (e) {
        logger.error(`Failed to notify user ${subscriberId}: ${e.message}`);
      }
    }

    res.json({ success: true, vacancy: newVacancy });
  } catch (e) {
    logger.error(`Error in POST /api/vacancies: ${e.message}`);
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
    res.json({ success: true, vacancy });
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
      photoUrl: photoUrl || "https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp",
      createdAt: new Date().toISOString(),
      pinned: false,
    };

    tasksData.push(newTask);
    await fs.writeFile(TASKS_FILE, JSON.stringify(tasksData, null, 2));

    res.json({ success: true, task: newTask });
  } catch (e) {
    logger.error(`Error in POST /api/tasks: ${e.message}`);
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
    res.json({ success: true, task });
  } catch (e) {
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
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.get("/api/reviews/:userId", async (req, res) => {
  const { userId } = req.params;
  const reviews = Object.values(reviewsData).filter((review) => review.targetUserId === userId);
  res.json(reviews);
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

    const { targetUserId, text } = req.body;
    if (!targetUserId || !text) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const payload = `${user.id}_${targetUserId}_${Date.now()}`;
    reviewsData[payload] = { authorUserId: user.id, targetUserId, text };

    const invoiceLink = await bot.api.createInvoiceLink(
      "Review Payment",
      `Pay 1 XTR to leave a review for user ${targetUserId}`,
      payload,
      "",
      "XTR",
      [{ label: "Review Fee", amount: 1 }]
    );

    res.json({ success: true, invoiceLink });
  } catch (e) {
    logger.error(`Error in POST /api/reviews: ${e.message}`);
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
    const isAdmin = user.id && ADMIN_IDS.includes(user.id.toString());

    res.json({ isAdmin });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
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

    if (!user.id) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const favoritesFile = path.join(__dirname, `favorites_${user.id}.json`);
    let favoritesData = [];
    try {
      const rawData = await fs.readFile(favoritesFile, "utf8");
      favoritesData = rawData.trim() ? JSON.parse(rawData) : [];
    } catch (e) {
      favoritesData = [];
    }

    res.json(favoritesData);
  } catch (e) {
    logger.error(`Error in GET /api/favorites: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/toggleFavorite", async (req, res) => {
  const favoritesMutex = new Mutex();
  const release = await favoritesMutex.acquire();
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    const { itemId } = req.body;
    if (!itemId) {
      return res.status(400).json({ error: "Item ID is required" });
    }

    const favoritesFile = path.join(__dirname, `favorites_${user.id}.json`);
    let favoritesData = [];
    try {
      const rawData = await fs.readFile(favoritesFile, "utf8");
      favoritesData = rawData.trim() ? JSON.parse(rawData) : [];
    } catch (e) {
      favoritesData = [];
    }

    const index = favoritesData.indexOf(itemId);
    if (index === -1) {
      favoritesData.push(itemId);
    } else {
      favoritesData.splice(index, 1);
    }

    await fs.writeFile(favoritesFile, JSON.stringify(favoritesData, null, 2));
    res.json({ success: true, favorites: favoritesData });
  } catch (e) {
    logger.error(`Error in POST /api/toggleFavorite: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.post("/api/subscribeFreelancer", async (req, res) => {
  const release = await freelancerSubscriptionsMutex.acquire();
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    const { position } = req.body;
    if (!position) {
      return res.status(400).json({ error: "Position is required" });
    }

    if (!freelancerSubscriptionsData[user.id]) {
      freelancerSubscriptionsData[user.id] = [];
    }

    if (!freelancerSubscriptionsData[user.id].includes(position)) {
      freelancerSubscriptionsData[user.id].push(position);
      await fs.writeFile(FREELANCER_SUBSCRIPTIONS_FILE, JSON.stringify(freelancerSubscriptionsData, null, 2));
      res.json({ success: true, message: "Subscribed successfully" });
    } else {
      res.json({ success: false, message: "Already subscribed" });
    }
  } catch (e) {
    logger.error(`Error in POST /api/subscribeFreelancer: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.get("/api/subscriptions/freelancer", async (req, res) => {
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    const subscriptions = freelancerSubscriptionsData[user.id] || [];
    res.json({ subscriptions });
  } catch (e) {
    logger.error(`Error in GET /api/subscriptions/freelancer: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/subscribeCompany", async (req, res) => {
  const release = await companySubscriptionsMutex.acquire();
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    const { companyUserId } = req.body;
    if (!companyUserId) {
      return res.status(400).json({ error: "Company User ID is required" });
    }

    if (!companySubscriptionsData[user.id]) {
      companySubscriptionsData[user.id] = [];
    }

    if (!companySubscriptionsData[user.id].includes(companyUserId)) {
      companySubscriptionsData[user.id].push(companyUserId);
      await fs.writeFile(COMPANY_SUBSCRIPTIONS_FILE, JSON.stringify(companySubscriptionsData, null, 2));
      res.json({ success: true, message: "Subscribed successfully" });
    } else {
      res.json({ success: false, message: "Already subscribed" });
    }
  } catch (e) {
    logger.error(`Error in POST /api/subscribeCompany: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.get("/api/subscriptions/company", async (req, res) => {
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    const subscriptions = companySubscriptionsData[user.id] || [];
    res.json({ subscriptions });
  } catch (e) {
    logger.error(`Error in GET /api/subscriptions/company: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/createChatInvoice", async (req, res) => {
  const release = await chatsMutex.acquire();
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user"));
    const { targetUserId, jobId } = req.body;

    if (!user?.id || !targetUserId) {
      return res.status(400).json({ error: "Invalid data" });
    }

    const payload = `${user.id}_${targetUserId}_${Date.now()}`;
    chatsData[payload] = { senderId: user.id, targetUserId, jobId, unlocked: false };
    await fs.writeFile(CHATS_FILE, JSON.stringify(chatsData, null, 2));

    const invoiceLink = await bot.api.createInvoiceLink(
      "Unlock Chat",
      `Pay 1 XTR to chat with freelancer (ID: ${targetUserId})`,
      payload,
      "",
      "XTR",
      [{ label: "Chat Unlock", amount: 1 }]
    );

    res.json({ success: true, invoiceLink });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.get("/api/chat/status/:targetUserId", async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    const chatKey = Object.keys(chatsData).find(
      (key) => chatsData[key].senderId === user.id && chatsData[key].targetUserId === targetUserId
    );
    const unlocked = chatKey && chatsData[chatKey].unlocked;

    res.json({ unlocked: !!unlocked });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/chat/:targetUserId", async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    const chatKey = Object.keys(chatsData).find(
      (key) => chatsData[key].senderId === user.id && chatsData[key].targetUserId === targetUserId
    );
    if (!chatKey || !chatsData[chatKey].unlocked) {
      return res.status(403).json({ error: "Chat not unlocked" });
    }

    res.json({ messages: chatsData[chatKey].messages || [] });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/chat/:targetUserId", async (req, res) => {
  const release = await chatsMutex.acquire();
  try {
    const { targetUserId } = req.params;
    const { text } = req.body;
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");

    const chatKey = Object.keys(chatsData).find(
      (key) => chatsData[key].senderId === user.id && chatsData[key].targetUserId === targetUserId
    );
    if (!chatKey || !chatsData[chatKey].unlocked) {
      return res.status(403).json({ error: "Chat not unlocked" });
    }

    if (!chatsData[chatKey].messages) chatsData[chatKey].messages = [];
    const message = { text, isSender: true, timestamp: new Date().toISOString() };
    chatsData[chatKey].messages.push(message);
    await fs.writeFile(CHATS_FILE, JSON.stringify(chatsData, null, 2));

    res.json({ success: true, message });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  } finally {
    release();
  }
});

app.post("/api/notifyFreelancer", async (req, res) => {
  try {
    const { targetUserId, text } = req.body;
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await bot.api.sendMessage(
      targetUserId,
      `Новое сообщение:\n\n${text}\n\nОтветьте через Telegram: https://t.me/workiks_admin`
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

bot.on("message:successful_payment", async (ctx) => {
  const releaseChats = await chatsMutex.acquire();
  const releaseReviews = await reviewsMutex.acquire();
  try {
    const payload = ctx.message.successful_payment.invoice_payload;

    if (chatsData[payload]) {
      const { senderId, targetUserId } = chatsData[payload];
      chatsData[payload].unlocked = true;
      await fs.writeFile(CHATS_FILE, JSON.stringify(chatsData, null, 2));

      await ctx.reply("Чат успешно разблокирован!");
      await bot.api.sendMessage(targetUserId, "Кто-то оплатил чат с вами. Проверьте сообщения!");
    } else if (reviewsData[payload]) {
      const { authorUserId, targetUserId, text } = reviewsData[payload];
      const reviewKey = `${authorUserId}_${Date.now()}`;
      reviewsData[reviewKey] = { text, authorUserId, targetUserId, date: new Date().toISOString() };
      delete reviewsData[payload];
      await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviewsData, null, 2));

      await ctx.reply("Отзыв опубликован! Спасибо!");
      const authorData = await bot.api.getChat(authorUserId);
      const authorUsername = authorData.username ? `@${authorData.username}` : "Неизвестный пользователь";
      const escapeMarkdownV2 = (str) => str.replace(/([_*[\]()~`>#+=|{}.!-])/g, "\\$1");
      const message =
        `*Новый отзыв\\!*\n\n` +
        `Пользователь *${escapeMarkdownV2(authorUsername)}* оставил вам отзыв:\n` +
        `> ${escapeMarkdownV2(text)}\n\n` +
        `Дата: ${escapeMarkdownV2(new Date().toLocaleString())}`;
      await bot.api.sendMessage(targetUserId, message, { parse_mode: "MarkdownV2" });
    } else {
      await ctx.reply("Ошибка: не удалось обработать платеж. Обратитесь в поддержку.");
    }
  } catch (e) {
    await ctx.reply("Произошла ошибка при обработке платежа.");
  } finally {
    releaseChats();
    releaseReviews();
  }
});

Promise.all([
  initReviewsFile().then(loadReviews),
  initJobsFile().then(loadJobs),
  initFreelancerSubscriptionsFile().then(loadFreelancerSubscriptions),
  initVacanciesFile().then(loadVacancies),
  initCompanySubscriptionsFile().then(loadCompanySubscriptions),
  initTasksFile().then(loadTasks),
  initChatsFile().then(loadChats),
]).then(() => {
  bot.start();
  app.listen(port, () => logger.info(`Server running on port ${port}`));
}).catch((e) => logger.error(`Failed to initialize: ${e.message}`));