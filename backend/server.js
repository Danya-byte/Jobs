const { Bot } = require("grammy");
const { rateLimiter } = require("@grammyjs/ratelimiter");
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const crypto = require("crypto");
const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const { PrismaClient } = require("@prisma/client");
const redis = require("redis");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const prisma = new PrismaClient();
const redisClient = redis.createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
const ADMIN_IDS = ["1029594875", "1871247390", "1940359844", "6629517298", "6568279325"];

// Инициализация бота
const bot = new Bot(BOT_TOKEN);
bot.use(rateLimiter({ timeFrame: 60000, limit: 30 })); // Ограничение 30 запросов в минуту

// Логирование
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

// Middleware
app.use(compression()); // Сжатие ответов
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], credentials: true }));

// Логирование запросов
app.use((req, res, next) => {
  const startTime = Date.now();
  const oldJson = res.json;

  res.json = function (data) {
    const duration = Date.now() - startTime;
    logger.info(`Request: ${req.method} ${req.path} | Response: ${JSON.stringify(data)} | Duration: ${duration}ms`);
    return oldJson.call(this, data);
  };
  next();
});

// Валидация Telegram данных
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

// Эндпоинты для Jobs
app.get("/api/jobs", async (req, res) => {
  try {
    const cached = await redisClient.get("jobs");
    if (cached) return res.json(JSON.parse(cached));

    const jobs = await prisma.job.findMany({ orderBy: { createdAt: "desc" } });
    await redisClient.setEx("jobs", 3600, JSON.stringify(jobs)); // Кэш на 1 час
    res.json(jobs);
  } catch (e) {
    logger.error(`Error in GET /api/jobs: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/jobs", async (req, res) => {
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

    // Очистка кэша
    await redisClient.del("jobs");

    // Уведомление подписчиков
    const subscribers = await prisma.freelancerSubscription.findMany({
      where: { positions: { has: position } },
    });

    for (const subscriber of subscribers) {
      try {
        await bot.api.sendMessage(
          subscriber.userId,
          `🎉 Новый фрилансер на позицию "${position}":\n\n📝 Описание: ${description}\n🔗 Контакт: https://t.me/workiks_admin`
        );
      } catch (e) {
        logger.error(`Failed to notify user ${subscriber.userId}: ${e.message}`);
      }
    }

    res.json({ success: true, job: newJob });
  } catch (e) {
    logger.error(`Error in POST /api/jobs: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/jobs/:jobId", async (req, res) => {
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

    await prisma.job.delete({ where: { id: jobId } });
    await redisClient.del("jobs"); // Очистка кэша
    res.json({ success: true });
  } catch (e) {
    logger.error(`Error in DELETE /api/jobs: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Эндпоинты для Vacancies
app.get("/api/vacancies", async (req, res) => {
  try {
    const cached = await redisClient.get("vacancies");
    if (cached) return res.json(JSON.parse(cached));

    const vacancies = await prisma.vacancy.findMany({ orderBy: { createdAt: "desc" } });
    await redisClient.setEx("vacancies", 3600, JSON.stringify(vacancies)); // Кэш на 1 час
    res.json(vacancies);
  } catch (e) {
    logger.error(`Error in GET /api/vacancies: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/vacancies", async (req, res) => {
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

    await redisClient.del("vacancies"); // Очистка кэша

    const subscribers = await prisma.companySubscription.findMany({
      where: { companies: { has: companyName } },
    });

    for (const subscriber of subscribers) {
      try {
        await bot.api.sendMessage(
          subscriber.userId,
          `🏢 Компания "${companyName}" разместила новую вакансию:\n\n📌 Позиция: ${position}\n📝 Описание: ${description}\n🔗 Контакт: ${contact}`
        );
      } catch (e) {
        logger.error(`Failed to notify user ${subscriber.userId}: ${e.message}`);
      }
    }

    res.json({ success: true, vacancy: newVacancy });
  } catch (e) {
    logger.error(`Error in POST /api/vacancies: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/vacancies/:vacancyId", async (req, res) => {
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

    await prisma.vacancy.delete({ where: { id: vacancyId } });
    await redisClient.del("vacancies"); // Очистка кэша
    res.json({ success: true });
  } catch (e) {
    logger.error(`Error in DELETE /api/vacancies: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Эндпоинты для пользователей
app.get("/api/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const cached = await redisClient.get(`user:${userId}`);
    if (cached) return res.json(JSON.parse(cached));

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
      } catch (e) {
        firstName = userJob ? userJob.nick : userVacancy ? userVacancy.companyName : "Unknown";
        responseUsername = userJob ? userJob.username : null;
        if (responseUsername) photoUrl = `https://t.me/i/userpic/160/${responseUsername}.jpg`;
      }
    }

    const userData = { firstName, username: responseUsername, photoUrl };
    await redisClient.setEx(`user:${userId}`, 86400, JSON.stringify(userData)); // Кэш на 24 часа
    res.json(userData);
  } catch (e) {
    logger.error(`Error in GET /api/user: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Эндпоинты для избранного
app.post("/api/toggleFavorite", async (req, res) => {
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
    await redisClient.del(`favorites:${userId}`); // Очистка кэша
    res.json({ success: true, favorites: favorites.map(f => f.itemId) });
  } catch (e) {
    logger.error(`Error in POST /api/toggleFavorite: ${e.message}`);
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
    const userId = user.id.toString();

    const cached = await redisClient.get(`favorites:${userId}`);
    if (cached) return res.json(JSON.parse(cached));

    const favorites = await prisma.favorite.findMany({ where: { userId }, select: { itemId: true } });
    const favoriteIds = favorites.map(f => f.itemId);
    await redisClient.setEx(`favorites:${userId}`, 3600, JSON.stringify(favoriteIds));
    res.json(favoriteIds);
  } catch (e) {
    logger.error(`Error in GET /api/favorites: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Эндпоинты для отзывов
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

    res.json({ success: true, invoiceLink });
  } catch (e) {
    logger.error(`Error in POST /api/createInvoiceLink: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/reviews", async (req, res) => {
  try {
    const { targetUserId } = req.query;
    const reviews = await prisma.review.findMany({
      where: { targetUserId, date: { not: null } },
      orderBy: { date: "desc" },
    });
    res.json(reviews);
  } catch (e) {
    logger.error(`Error in GET /api/reviews: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/reviews/:reviewId", async (req, res) => {
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

    await prisma.review.delete({ where: { id: reviewId } });
    res.json({ success: true });
  } catch (e) {
    logger.error(`Error in DELETE /api/reviews: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Проверка админского статуса
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

// Обработка платежей Telegram
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

// Очистка старых временных отзывов
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

// Запуск сервера
async function startServer() {
  try {
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