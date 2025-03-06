const { Bot } = require("grammy");
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
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || "your-32-char-secret-key-here", "hex"); // 32 байта для AES-256
const prisma = new PrismaClient();
const redisClient = redis.createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
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

// Оптимизированный middleware для логирования
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

// Функция для шифрования данных
function encrypt(data) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
  encrypted += cipher.final("hex");
  return { iv: iv.toString("hex"), encryptedData: encrypted };
}

// Функция для проверки Telegram данных
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

// Эндпоинт с пагинацией и кэшированием
app.get("/api/jobs", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const cacheKey = `jobs:${page}:${limit}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const { iv, encryptedData } = JSON.parse(cached);
      return res.json({ iv, encryptedData }); // Возвращаем зашифрованные данные из кэша
    }

    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: "desc" },
      skip: parseInt(skip),
      take: parseInt(limit),
    });
    const encrypted = encrypt(jobs);
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(encrypted));
    res.json(encrypted); // Возвращаем зашифрованные данные
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

    const keys = await redisClient.keys("jobs:*");
    if (keys.length) await redisClient.del(keys);

    const subscribers = await prisma.freelancerSubscription.findMany({
      where: { positions: { has: position } },
    });

    await Promise.all(
      subscribers.map(subscriber =>
        bot.api.sendMessage(
          subscriber.userId,
          `🎉 Новый фрилансер на позицию "${position}":\n\n📝 Описание: ${description}\n🔗 Контакт: https://t.me/workiks_admin`
        ).catch(e => logger.error(`Failed to notify user ${subscriber.userId}: ${e.message}`))
      )
    );

    res.json(encrypt({ success: true, job: newJob })); // Зашифрованный ответ
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
    const keys = await redisClient.keys("jobs:*");
    if (keys.length) await redisClient.del(keys);
    res.json(encrypt({ success: true })); // Зашифрованный ответ
  } catch (e) {
    logger.error(`Error in DELETE /api/jobs: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/vacancies", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const cacheKey = `vacancies:${page}:${limit}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const { iv, encryptedData } = JSON.parse(cached);
      return res.json({ iv, encryptedData }); // Возвращаем зашифрованные данные из кэша
    }

    const vacancies = await prisma.vacancy.findMany({
      orderBy: { createdAt: "desc" },
      skip: parseInt(skip),
      take: parseInt(limit),
    });
    const encrypted = encrypt(vacancies);
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(encrypted));
    res.json(encrypted); // Возвращаем зашифрованные данные
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

    const { companyUserId, companyName, position, description, requirements, tags, categories, contact, officialWebsite, verified, photoUrl } = req.body;

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

    const keys = await redisClient.keys("vacancies:*");
    if (keys.length) await redisClient.del(keys);

    const subscribers = await prisma.companySubscription.findMany({
      where: { companies: { has: companyName } },
    });

    await Promise.all(
      subscribers.map(subscriber =>
        bot.api.sendMessage(
          subscriber.userId,
          `🏢 Компания "${companyName}" разместила новую вакансию:\n\n📌 Позиция: ${position}\n📝 Описание: ${description}\n🔗 Контакт: ${contact}`
        ).catch(e => logger.error(`Failed to notify user ${subscriber.userId}: ${e.message}`))
      )
    );

    res.json(encrypt({ success: true, vacancy: newVacancy })); // Зашифрованный ответ
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
    const keys = await redisClient.keys("vacancies:*");
    if (keys.length) await redisClient.del(keys);
    res.json(encrypt({ success: true })); // Зашифрованный ответ
  } catch (e) {
    logger.error(`Error in DELETE /api/vacancies: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const telegramData = req.headers["x-telegram-data"];
    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const cacheKey = `user:${userId}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const { iv, encryptedData } = JSON.parse(cached);
      return res.json({ iv, encryptedData }); // Возвращаем зашифрованные данные из кэша
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
      } catch (e) {
        firstName = userJob ? userJob.nick : userVacancy ? userVacancy.companyName : "Unknown";
        responseUsername = userJob ? userJob.username : null;
        if (responseUsername) photoUrl = `https://t.me/i/userpic/160/${responseUsername}.jpg`;
      }
    }

    const userData = { firstName, username: responseUsername, photoUrl };
    const encrypted = encrypt(userData);
    await redisClient.setEx(cacheKey, 86400, JSON.stringify(encrypted));
    res.json(encrypted); // Возвращаем зашифрованные данные
  } catch (e) {
    logger.error(`Error in GET /api/user: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
    await redisClient.del(`favorites:${userId}`);
    res.json(encrypt({ success: true, favorites: favorites.map(f => f.itemId) })); // Зашифрованный ответ
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

    const cacheKey = `favorites:${userId}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const { iv, encryptedData } = JSON.parse(cached);
      return res.json({ iv, encryptedData }); // Возвращаем зашифрованные данные из кэша
    }

    const favorites = await prisma.favorite.findMany({ where: { userId }, select: { itemId: true } });
    const favoriteIds = favorites.map(f => f.itemId);
    const encrypted = encrypt(favoriteIds);
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(encrypted));
    res.json(encrypted); // Возвращаем зашифрованные данные
  } catch (e) {
    logger.error(`Error in GET /api/favorites: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
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

    res.json(encrypt({ success: true, invoiceLink })); // Зашифрованный ответ
  } catch (e) {
    logger.error(`Error in POST /api/createInvoiceLink: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/reviews", async (req, res) => {
  try {
    const { targetUserId, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const cacheKey = `reviews:${targetUserId}:${page}:${limit}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const { iv, encryptedData } = JSON.parse(cached);
      return res.json({ iv, encryptedData }); // Возвращаем зашифрованные данные из кэша
    }

    const reviews = await prisma.review.findMany({
      where: { targetUserId, date: { not: null } },
      orderBy: { date: "desc" },
      skip: parseInt(skip),
      take: parseInt(limit),
    });
    const encrypted = encrypt(reviews);
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(encrypted));
    res.json(encrypted); // Возвращаем зашифрованные данные
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

    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    await prisma.review.delete({ where: { id: reviewId } });
    const keys = await redisClient.keys(`reviews:${review.targetUserId}:*`);
    if (keys.length) await redisClient.del(keys);
    res.json(encrypt({ success: true })); // Зашифрованный ответ
  } catch (e) {
    logger.error(`Error in DELETE /api/reviews: ${e.message}`);
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

    if (!user.id) {
      return res.status(400).json({ error: "Invalid user data" });
    }

    const isAdmin = ADMIN_IDS.includes(user.id.toString());
    res.json(encrypt({ isAdmin })); // Зашифрованный ответ
  } catch (e) {
    logger.error(`Error in GET /api/isAdmin: ${e.message}`);
    res.status(500).json({ error: "Internal server error" });
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
    console.log("Connecting to database...");
    console.log("Using DATABASE_URL:", process.env.DATABASE_URL);
    await prisma.$connect();
    console.log("Connected to database");
    await redisClient.connect();
    logger.info("Connected to Redis");
    app.listen(port, () => {
      bot.start();
      logger.info(`Server running on port ${port}`);
    });
  } catch (e) {
    console.error("Error details:", e);
    logger.error(`Failed to start server: ${e.message}`);
    process.exit(1);
  }
}

startServer();

process.on("uncaughtException", (err) => logger.error(`Uncaught Exception: ${err.message}`));
process.on("unhandledRejection", (reason) => logger.error(`Unhandled Rejection: ${reason}`));