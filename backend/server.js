const { Bot } = require("grammy");
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const crypto = require("crypto");
const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const { PrismaClient } = require("@prisma/client");
const redis = require("redis");
const Queue = require("bull");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || "cd1f4ab91882737f02e7a109e82af74ba8f5896cb288812636753119b4277d46", "hex");
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
const redisClient = redis.createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
const notificationQueue = new Queue("notifications", process.env.REDIS_URL || "redis://localhost:6379");
const ADMIN_IDS = ["1029594875", "1871247390", "1940359844", "6629517298", "6568279325"];
const bot = new Bot(BOT_TOKEN);

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new DailyRotateFile({
      filename: "logs/%DATE%-app.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
    }),
  ],
});

app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], credentials: true }));

app.use((req, res, next) => {
  const startTime = Date.now();
  const oldJson = res.json;
  res.json = function (data) {
    const duration = Date.now() - startTime;
    logger.info(`Request: ${req.method} ${req.path} | Status: ${res.statusCode} | Duration: ${duration}ms`);
    return oldJson.call(this, data);
  };
  next();
});

function encrypt(data) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
  encrypted += cipher.final("hex");
  return { iv: iv.toString("hex"), encryptedData: encrypted };
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
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    if (isNaN(page) || isNaN(limit) || page < 1 || limit < 1) {
      return res.status(400).json(encrypt({ error: "Invalid page or limit parameters" }));
    }
    const cacheKey = `jobs:${page}:${limit}`;
    let cached = await redisClient.get(cacheKey);
    if (cached) {
      const { iv, encryptedData } = JSON.parse(cached);
      return res.json({ iv, encryptedData });
    }
    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: "desc" },
      skip: parseInt(skip),
      take: parseInt(limit),
    });
    const encrypted = encrypt(jobs);
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(encrypted));
    res.json(encrypted);
  } catch (e) {
    logger.error(`Error in GET /api/jobs: ${e.message}, Stack: ${e.stack}`);
    res.status(500).json(encrypt({ error: "Internal server error", details: e.message }));
  }
});

app.post("/api/jobs", async (req, res) => {
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json(encrypt({ error: "Unauthorized" }));
    }
    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");
    if (!user.id || !ADMIN_IDS.includes(user.id.toString())) {
      return res.status(403).json(encrypt({ error: "Forbidden" }));
    }
    const { userId, nick, position, experience, description, requirements, tags, categories } = req.body;
    if (!userId || !nick || !position || !description || !requirements || !tags) {
      return res.status(400).json(encrypt({ error: "Missing required fields" }));
    }
    const newJob = await prisma.job.create({
      data: {
        adminId: user.id.toString(),
        userId: userId.toString(),
        username: req.body.username || "unknown",
        nick,
        position,
        profileLink: `/profile/${userId}`,
        experience: experience ? parseInt(experience) : null,
        description,
        requirements,
        tags,
        categories: categories || [],
        contact: "https://t.me/workiks_admin",
      },
    });
    const encrypted = encrypt({ success: true, job: newJob });
    res.json(encrypted);
    const subscribers = await prisma.freelancerSubscription.findMany({
      where: { positions: { has: position } },
    });
    notificationQueue.add({ subscribers, job: newJob });
    const pageKeys = await redisClient.keys(`jobs:*:${limit || 10}`);
    if (pageKeys.length) await redisClient.del(pageKeys);
  } catch (e) {
    logger.error(`Error in POST /api/jobs: ${e.message}, Stack: ${e.stack}`);
    res.status(500).json(encrypt({ error: "Internal server error", details: e.message }));
  }
});

app.delete("/api/jobs/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json(encrypt({ error: "Unauthorized" }));
    }
    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");
    if (!user.id || !ADMIN_IDS.includes(user.id.toString())) {
      return res.status(403).json(encrypt({ error: "Forbidden" }));
    }
    if (!jobId) {
      return res.status(400).json(encrypt({ error: "Missing jobId" }));
    }
    await prisma.job.delete({ where: { id: jobId } });
    const pageKeys = await redisClient.keys(`jobs:*:${limit || 10}`);
    if (pageKeys.length) await redisClient.del(pageKeys);
    res.json(encrypt({ success: true }));
  } catch (e) {
    logger.error(`Error in DELETE /api/jobs: ${e.message}, Stack: ${e.stack}`);
    res.status(500).json(encrypt({ error: "Internal server error", details: e.message }));
  }
});

app.get("/api/vacancies", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    if (isNaN(page) || isNaN(limit) || page < 1 || limit < 1) {
      return res.status(400).json(encrypt({ error: "Invalid page or limit parameters" }));
    }
    const cacheKey = `vacancies:${page}:${limit}`;
    let cached = await redisClient.get(cacheKey);
    if (cached) {
      const { iv, encryptedData } = JSON.parse(cached);
      return res.json({ iv, encryptedData });
    }
    const vacancies = await prisma.vacancy.findMany({
      orderBy: { createdAt: "desc" },
      skip: parseInt(skip),
      take: parseInt(limit),
    });
    const encrypted = encrypt(vacancies);
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(encrypted));
    res.json(encrypted);
  } catch (e) {
    logger.error(`Error in GET /api/vacancies: ${e.message}, Stack: ${e.stack}`);
    res.status(500).json(encrypt({ error: "Internal server error", details: e.message }));
  }
});

app.post("/api/vacancies", async (req, res) => {
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json(encrypt({ error: "Unauthorized" }));
    }
    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");
    if (!user.id || !ADMIN_IDS.includes(user.id.toString())) {
      return res.status(403).json(encrypt({ error: "Forbidden" }));
    }
    const { companyUserId, companyName, position, description, requirements, tags, categories, contact, officialWebsite, verified, photoUrl } = req.body;
    if (!companyUserId || !companyName || !position || !description || !requirements || !tags || !contact || !officialWebsite || !photoUrl) {
      return res.status(400).json(encrypt({ error: "Missing required fields" }));
    }
    const newVacancy = await prisma.vacancy.create({
      data: {
        adminId: user.id.toString(),
        companyUserId: companyUserId.toString(),
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
      },
    });
    const encrypted = encrypt({ success: true, vacancy: newVacancy });
    res.json(encrypted);
    const subscribers = await prisma.companySubscription.findMany({
      where: { companies: { has: companyName } },
    });
    notificationQueue.add({ subscribers, vacancy: newVacancy });
    const pageKeys = await redisClient.keys(`vacancies:*:${limit || 10}`);
    if (pageKeys.length) await redisClient.del(pageKeys);
  } catch (e) {
    logger.error(`Error in POST /api/vacancies: ${e.message}, Stack: ${e.stack}`);
    res.status(500).json(encrypt({ error: "Internal server error", details: e.message }));
  }
});

app.delete("/api/vacancies/:vacancyId", async (req, res) => {
  try {
    const { vacancyId } = req.params;
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json(encrypt({ error: "Unauthorized" }));
    }
    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");
    if (!user.id || !ADMIN_IDS.includes(user.id.toString())) {
      return res.status(403).json(encrypt({ error: "Forbidden" }));
    }
    if (!vacancyId) {
      return res.status(400).json(encrypt({ error: "Missing vacancyId" }));
    }
    await prisma.vacancy.delete({ where: { id: vacancyId } });
    const pageKeys = await redisClient.keys(`vacancies:*:${limit || 10}`);
    if (pageKeys.length) await redisClient.del(pageKeys);
    res.json(encrypt({ success: true }));
  } catch (e) {
    logger.error(`Error in DELETE /api/vacancies: ${e.message}, Stack: ${e.stack}`);
    res.status(500).json(encrypt({ error: "Internal server error", details: e.message }));
  }
});

app.get("/api/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json(encrypt({ error: "Unauthorized" }));
    }
    if (!userId) {
      return res.status(400).json(encrypt({ error: "Missing userId" }));
    }
    const cacheKey = `user:${userId}`;
    let cached = await redisClient.get(cacheKey);
    if (cached) {
      const { iv, encryptedData } = JSON.parse(cached);
      return res.json({ iv, encryptedData });
    }
    const userJob = await prisma.job.findFirst({ where: { userId } });
    const userVacancy = await prisma.vacancy.findFirst({ where: { companyUserId: userId } });
    let firstName = "Unknown";
    let photoUrl = "https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp";
    let responseUsername = null;
    if (userJob || userVacancy) {
      try {
        const userData = await bot.api.getChat(userJob ? userJob.userId : userVacancy.companyUserId);
        firstName = userData.first_name || "Unknown";
        responseUsername = userData.username || null;
        if (responseUsername) photoUrl = `https://t.me/i/userpic/160/${responseUsername}.jpg`;
      } catch {
        firstName = userJob ? userJob.nick : userVacancy ? userVacancy.companyName : "Unknown";
        responseUsername = userJob ? userJob.username : null;
        if (responseUsername) photoUrl = `https://t.me/i/userpic/160/${responseUsername}.jpg`;
      }
    }
    const userData = { firstName, username: responseUsername, photoUrl };
    const encrypted = encrypt(userData);
    await redisClient.setEx(cacheKey, 86400, JSON.stringify(encrypted));
    res.json(encrypted);
  } catch (e) {
    logger.error(`Error in GET /api/user: ${e.message}, Stack: ${e.stack}`);
    res.status(500).json(encrypt({ error: "Internal server error", details: e.message }));
  }
});

app.post("/api/toggleFavorite", async (req, res) => {
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json(encrypt({ error: "Unauthorized" }));
    }
    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");
    const { itemId } = req.body;
    if (!user.id || !itemId) {
      return res.status(400).json(encrypt({ error: "Missing required fields" }));
    }
    const userId = user.id.toString();
    const existingFavorite = await prisma.favorite.findUnique({
      where: { userId_itemId: { userId, itemId } },
    });
    if (existingFavorite) {
      await prisma.favorite.delete({ where: { userId_itemId: { userId, itemId } } });
    } else {
      await prisma.favorite.create({ data: { userId, itemId } });
      const job = await prisma.job.findUnique({ where: { id: itemId } });
      const vacancy = await prisma.vacancy.findUnique({ where: { id: itemId } });
      if (job) {
        await prisma.freelancerSubscription.upsert({
          where: { userId },
          update: { positions: { push: job.position } },
          create: { userId, positions: [job.position] },
        });
      } else if (vacancy) {
        await prisma.companySubscription.upsert({
          where: { userId },
          update: { companies: { push: vacancy.companyName } },
          create: { userId, companies: [vacancy.companyName] },
        });
      }
    }
    const favorites = await prisma.favorite.findMany({ where: { userId }, select: { itemId: true } });
    await redisClient.setEx(`favorites:${userId}`, 3600, JSON.stringify(favorites.map(f => f.itemId)));
    res.json(encrypt({ success: true, favorites: favorites.map(f => f.itemId) }));
  } catch (e) {
    logger.error(`Error in POST /api/toggleFavorite: ${e.message}, Stack: ${e.stack}`);
    res.status(500).json(encrypt({ error: "Internal server error", details: e.message }));
  }
});

app.get("/api/favorites", async (req, res) => {
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json(encrypt({ error: "Unauthorized" }));
    }
    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");
    const userId = user.id.toString();
    if (!userId) {
      return res.status(400).json(encrypt({ error: "Missing userId" }));
    }
    const cacheKey = `favorites:${userId}`;
    let cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(encrypt(JSON.parse(cached)));
    }
    const favorites = await prisma.favorite.findMany({ where: { userId }, select: { itemId: true } });
    const favoriteIds = favorites.map(f => f.itemId);
    const encrypted = encrypt(favoriteIds);
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(favoriteIds));
    res.json(encrypted);
  } catch (e) {
    logger.error(`Error in GET /api/favorites: ${e.message}, Stack: ${e.stack}`);
    res.status(500).json(encrypt({ error: "Internal server error", details: e.message }));
  }
});

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
    await prisma.review.create({
      data: { id: payload, text, authorUserId: user.id.toString(), targetUserId },
    });
    const invoiceLink = await bot.api.createInvoiceLink(
      "Submit a Review",
      "Pay 1 Telegram Star to submit a review",
      payload,
      "",
      "XTR",
      [{ label: "Review Submission", amount: 1 }]
    );
    res.json(encrypt({ success: true, invoiceLink }));
  } catch (e) {
    logger.error(`Error in POST /api/createInvoiceLink: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/reviews", async (req, res) => {
  try {
    const { targetUserId, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    if (!targetUserId || isNaN(page) || isNaN(limit) || page < 1 || limit < 1) {
      return res.status(400).json(encrypt({ error: "Invalid targetUserId, page, or limit parameters" }));
    }
    const cacheKey = `reviews:${targetUserId}:${page}:${limit}`;
    let cached = await redisClient.get(cacheKey);
    if (cached) {
      const { iv, encryptedData } = JSON.parse(cached);
      return res.json({ iv, encryptedData });
    }
    const reviews = await prisma.review.findMany({
      where: { targetUserId, date: { not: null } },
      orderBy: { date: "desc" },
      skip: parseInt(skip),
      take: parseInt(limit),
    });
    const encrypted = encrypt(reviews);
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(encrypted));
    res.json(encrypted);
  } catch (e) {
    logger.error(`Error in GET /api/reviews: ${e.message}, Stack: ${e.stack}`);
    res.status(500).json(encrypt({ error: "Internal server error", details: e.message }));
  }
});

app.get("/api/reviews/stream/:targetUserId", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  const { targetUserId } = req.params;
  const sendUpdate = async () => {
    const reviews = await prisma.review.findMany({
      where: { targetUserId, date: { not: null } },
      orderBy: { date: "desc" },
    });
    const encrypted = encrypt(reviews);
    res.write(`data: ${JSON.stringify(encrypted)}\n\n`);
  };
  sendUpdate();
  const interval = setInterval(sendUpdate, 5000);
  req.on("close", () => clearInterval(interval));
});

app.delete("/api/reviews/:reviewId", async (req, res) => {
  try {
    const { reviewId } = req.params;
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json(encrypt({ error: "Unauthorized" }));
    }
    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user"));
    if (!user.id || !ADMIN_IDS.includes(user.id.toString())) {
      return res.status(403).json(encrypt({ error: "Forbidden" }));
    }
    if (!reviewId) {
      return res.status(400).json(encrypt({ error: "Missing reviewId" }));
    }
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      return res.status(404).json(encrypt({ error: "Review not found" }));
    }
    await prisma.review.delete({ where: { id: reviewId } });
    const keys = await redisClient.keys(`reviews:${review.targetUserId}:*`);
    if (keys.length) await redisClient.del(keys);
    res.json(encrypt({ success: true }));
  } catch (e) {
    logger.error(`Error in DELETE /api/reviews: ${e.message}, Stack: ${e.stack}`);
    res.status(500).json(encrypt({ error: "Internal server error", details: e.message }));
  }
});

app.get("/api/isAdmin", async (req, res) => {
  try {
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json(encrypt({ error: "Unauthorized" }));
    }
    const params = new URLSearchParams(telegramData);
    const user = JSON.parse(params.get("user") || "{}");
    if (!user.id) {
      return res.status(400).json(encrypt({ error: "Invalid user data" }));
    }
    const isAdmin = ADMIN_IDS.includes(user.id.toString());
    res.json(encrypt({ isAdmin }));
  } catch (e) {
    logger.error(`Error in GET /api/isAdmin: ${e.message}, Stack: ${e.stack}`);
    res.status(500).json(encrypt({ error: "Internal server error", details: e.message }));
  }
});

bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on("message:successful_payment", async (ctx) => {
  try {
    const payload = ctx.message.successful_payment.invoice_payload;
    const review = await prisma.review.findUnique({ where: { id: payload } });
    if (!review) {
      await ctx.reply("Ошибка: не удалось обработать платеж. Обратитесь в поддержку.");
      return;
    }
    await prisma.review.update({
      where: { id: payload },
      data: { date: new Date().toISOString() },
    });
    const keys = await redisClient.keys(`reviews:${review.targetUserId}:*`);
    if (keys.length) await redisClient.del(keys);
    await ctx.reply("Отзыв опубликован! Спасибо!");
    const authorData = await bot.api.getChat(review.authorUserId);
    const authorUsername = authorData.username ? `@${authorData.username}` : "Неизвестный пользователь";
    const escapeMarkdownV2 = (str) => str.replace(/([_*[\]()~`>#+=|{}.!-])/g, "\\$1");
    const message =
      `*Новый отзыв\\!*\n\n` +
      `Пользователь *${escapeMarkdownV2(authorUsername)}* оставил вам отзыв:\n` +
      `> ${escapeMarkdownV2(review.text)}\n\n` +
      `Дата: ${escapeMarkdownV2(new Date().toLocaleString())}`;
    await bot.api.sendMessage(review.targetUserId, message, { parse_mode: "MarkdownV2" });
  } catch (e) {
    logger.error(`Error in payment processing: ${e.message}`);
    await ctx.reply("Произошла ошибка при обработке отзыва.");
  }
});

notificationQueue.process(async (job) => {
  const { subscribers, job, vacancy } = job.data;
  if (job) {
    await Promise.all(
      subscribers.map(subscriber =>
        bot.api.sendMessage(
          subscriber.userId,
          `🎉 Новый фрилансер на позицию "${job.position}":\n\n📝 Описание: ${job.description}\n🔗 Контакт: https://t.me/workiks_admin`
        ).catch(e => logger.error(`Failed to notify user ${subscriber.userId}: ${e.message}`))
      )
    );
  } else if (vacancy) {
    await Promise.all(
      subscribers.map(subscriber =>
        bot.api.sendMessage(
          subscriber.userId,
          `🏢 Компания "${vacancy.companyName}" разместила новую вакансию:\n\n📌 Позиция: ${vacancy.position}\n📝 Описание: ${vacancy.description}\n🔗 Контакт: ${vacancy.contact}`
        ).catch(e => logger.error(`Failed to notify user ${subscriber.userId}: ${e.message}`))
      )
    );
  }
});

async function cleanOldTempReviews() {
  try {
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    await prisma.review.deleteMany({
      where: { date: null, createdAt: { lte: oneHourAgo } },
    });
  } catch (e) {
    logger.error(`Error in cleanOldTempReviews: ${e.message}`);
  }
}

setInterval(cleanOldTempReviews, 10 * 60 * 1000);

async function startServer() {
  try {
    await prisma.$connect();
    await redisClient.connect();
    logger.info("Connected to Redis");
    app.listen(port, () => {
      bot.start();
      logger.info(`Server running on port ${port}`);
    });
  } catch (e) {
    logger.error(`Failed to start server: ${e.message}`);
    process.exit(1);
  }
}

startServer();

process.on("uncaughtException", (err) => logger.error(`Uncaught Exception: ${err.message}`));
process.on("unhandledRejection", (reason) => logger.error(`Unhandled Rejection: ${reason}`));