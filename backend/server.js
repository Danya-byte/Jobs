const { Bot } = require("grammy");
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
const JOBS_FILE = path.join(__dirname, "jobs.json");
const ADMIN_IDS = ["1940359844", "1871247390"];

const bot = new Bot(BOT_TOKEN);
bot.api.config.use(hydrateFiles(bot.token));

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Telegram-Data', 'Authorization', 'Cache-Control', 'X-Requested-With'],
  credentials: true,
  exposedHeaders: ['X-Telegram-Data']
};

app.use(express.json());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

async function initReviewsFile() {
  try {
    await fs.access(REVIEWS_FILE);
    const data = await fs.readFile(REVIEWS_FILE, 'utf8');
    if (!data.trim()) {
      await fs.writeFile(REVIEWS_FILE, "{}");
    }
  } catch {
    await fs.writeFile(REVIEWS_FILE, "{}");
  }
}

async function initJobsFile() {
  try {
    await fs.access(JOBS_FILE);
    const data = await fs.readFile(JOBS_FILE, 'utf8');
    if (!data.trim()) {
      const initialJobs = [
        {
          id: Date.now() + "_1",
          nick: "Matvey",
          userId: "1029594875",
          username: "whsxg",
          position: "Frontend Developer",
          profileLink: '/profile/1029594875',
          experience: "5 years experience",
          description: "Разработка Telegram Mini App по ТЗ с полным циклом от проектирования до запуска.",
          requirements: ["Опыт работы с Vue.js", "Знание HTML, CSS, JavaScript", "Интеграция с Telegram API"],
          tags: ["JavaScript", "Vue 3", "Telegram API"],
          contact: "https://t.me/workiks_admin"
        },
        {
          id: Date.now() + "_2",
          nick: "Danone",
          userId: "7079899705",
          username: "Danoneee777",
          position: "Moderator",
          profileLink: '/profile/7079899705',
          experience: "3 years experience",
          description: "Модерация сообществ и управление контентом.",
          requirements: ["Опыт работы с социальными сетями", "Коммуникативные навыки", "Знание основ модерации"],
          tags: ["Модерация", "Социальные сети"],
          contact: "https://t.me/Danoneee777"
        }
      ];
      await fs.writeFile(JOBS_FILE, JSON.stringify(initialJobs, null, 2));
    }
  } catch {
    const initialJobs = [
      {
        id: Date.now() + "_1",
        nick: "Matvey",
        userId: "1029594875",
        username: "whsxg",
        position: "Frontend Developer",
        profileLink: '/profile/1029594875',
        experience: "5 years experience",
        description: "Разработка Telegram Mini App по ТЗ с полным циклом от проектирования до запуска.",
        requirements: ["Опыт работы с Vue.js", "Знание HTML, CSS, JavaScript", "Интеграция с Telegram API"],
        tags: ["JavaScript", "Vue 3", "Telegram API"],
        contact: "https://t.me/workiks_admin"
      },
      {
        id: Date.now() + "_2",
        nick: "Danone",
        userId: "7079899705",
        username: "Danoneee777",
        position: "Moderator",
        profileLink: '/profile/7079899705',
        experience: "3 years experience",
        description: "Модерация сообществ и управление контентом.",
        requirements: ["Опыт работы с социальными сетями", "Коммуникативные навыки", "Знание основ модерации"],
        tags: ["Модерация", "Социальные сети"],
        contact: "https://t.me/Danoneee777"
      }
    ];
    await fs.writeFile(JOBS_FILE, JSON.stringify(initialJobs, null, 2));
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
    console.error("Error in validateTelegramData:", e);
    return false;
  }
}

app.get("/api/jobs", async (req, res) => {
  try {
    const rawData = await fs.readFile(JOBS_FILE, 'utf8');
    if (!rawData.trim()) {
      return res.json([]);
    }
    const jobsData = JSON.parse(rawData);
    res.json(jobsData);
  } catch (e) {
    console.error("Error in GET /api/jobs:", e);
    res.status(500).json({ error: "Failed to load jobs", details: e.message });
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

    const rawData = await fs.readFile(JOBS_FILE, 'utf8');
    let jobsData = rawData.trim() ? JSON.parse(rawData) : [];

    const newJob = {
      id: `${Date.now()}_${user.id}`,
      adminId: user.id, // ID администратора, который создал вакансию
      userId: req.body.userId, // ID пользователя, указанный админом
      username: req.body.username || "unknown",
      nick: req.body.nick,
      position: req.body.position,
      profileLink: `/profile/${req.body.userId}`, // Формируем profileLink на основе userId
      experience: req.body.experience,
      description: req.body.description,
      requirements: req.body.requirements,
      tags: req.body.tags,
      contact: req.body.contact
    };

    jobsData.push(newJob);
    await fs.writeFile(JOBS_FILE, JSON.stringify(jobsData, null, 2));

    res.json({ success: true, job: newJob });
  } catch (e) {
    console.error("Error in POST /api/jobs:", e);
    res.status(500).json({ error: "Failed to create job", details: e.message });
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

    const rawData = await fs.readFile(JOBS_FILE, 'utf8');
    let jobsData = rawData.trim() ? JSON.parse(rawData) : [];

    const jobIndex = jobsData.findIndex(job => job.id === jobId);
    if (jobIndex === -1) {
      return res.status(404).json({ error: "Job not found" });
    }

    jobsData.splice(jobIndex, 1);
    await fs.writeFile(JOBS_FILE, JSON.stringify(jobsData, null, 2));

    res.json({ success: true });
  } catch (e) {
    console.error("Error in DELETE /api/jobs:", e);
    res.status(500).json({ error: "Failed to delete job", details: e.message });
  }
});

app.get("/api/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const telegramData = req.headers["x-telegram-data"];

    if (!telegramData || !validateTelegramData(telegramData)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const params = new URLSearchParams(telegramData);
    const currentUser = JSON.parse(params.get("user"));

    let photoUrl = 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp';
    let firstName = 'Unknown';
    let username = null;

    if (currentUser.id.toString() === userId) {
      firstName = currentUser.first_name || 'Unknown';
      username = currentUser.username || null;
      photoUrl = currentUser.photo_url || (username ? `https://t.me/i/userpic/160/${username}.jpg` : photoUrl);
    } else {
      const member = await bot.api.getChatMember(userId, userId).catch(() => null);
      if (member?.user) {
        firstName = member.user.first_name || 'Unknown';
        username = member.user.username || null;
        photoUrl = username ? `https://t.me/i/userpic/160/${username}.jpg` : photoUrl;
      }
    }

    res.json({ firstName, username, photoUrl });
  } catch (e) {
    console.error("Error in GET /api/user:", e);
    res.json({
      firstName: 'Unknown',
      username: null,
      photoUrl: 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp'
    });
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

    if (!user?.id || !targetUserId) {
      return res.status(400).json({ error: "Invalid data" });
    }

    const payload = `${user.id}_${Date.now()}`;
    const rawData = await fs.readFile(REVIEWS_FILE, "utf8").catch(() => "{}");
    const reviewsData = JSON.parse(rawData);

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
    console.error("Error in POST /api/createInvoiceLink:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/reviews", async (req, res) => {
  try {
    const { targetUserId } = req.query;
    const rawData = await fs.readFile(REVIEWS_FILE, 'utf8');
    const reviewsData = JSON.parse(rawData);

    const reviews = Object.entries(reviewsData)
      .map(([id, data]) => ({ id, ...data }))
      .filter(review => review.targetUserId === targetUserId);

    res.json(reviews);
  } catch (e) {
    console.error("Error in GET /api/reviews:", e);
    res.status(500).json({ error: "Failed to load reviews" });
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

    if (!ADMIN_IDS.includes(user.id.toString())) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const rawData = await fs.readFile(REVIEWS_FILE, 'utf8');
    const reviewsData = JSON.parse(rawData);

    if (!reviewsData[reviewId]) {
      return res.status(404).json({ error: "Review not found" });
    }

    delete reviewsData[reviewId];
    await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviewsData, null, 2));

    res.json({ success: true });
  } catch (e) {
    console.error("Error in DELETE /api/reviews:", e);
    res.status(500).json({ error: e.message });
  }
});

bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on("message:successful_payment", async (ctx) => {
  const payload = ctx.message.successful_payment.invoice_payload;

  if (!payload) {
    await ctx.reply("Ошибка: не удалось обработать платеж. Обратитесь в поддержку.");
    return;
  }

  try {
    const rawData = await fs.readFile(REVIEWS_FILE, "utf8");
    const reviewsData = JSON.parse(rawData);

    if (reviewsData[payload]) {
      const { authorUserId, targetUserId, text } = reviewsData[payload];
      const reviewKey = `${authorUserId}_${Date.now()}`;
      reviewsData[reviewKey] = { text, authorUserId, targetUserId, date: new Date().toISOString() };
      delete reviewsData[payload];
      await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviewsData, null, 2));
      await ctx.reply("Отзыв опубликован! Спасибо!");
    }
  } catch (e) {
    console.error("Error in payment handler:", e);
    await ctx.reply("Произошла ошибка при обработке отзыва.");
  }
});

async function cleanOldTempReviews() {
  const rawData = await fs.readFile(REVIEWS_FILE, "utf8").catch(() => "{}");
  const reviewsData = JSON.parse(rawData);
  const now = Date.now();

  for (const [key, review] of Object.entries(reviewsData)) {
    if (!review.date && now - parseInt(key.split("_")[1]) > 60 * 60 * 1000) {
      delete reviewsData[key];
    }
  }

  await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviewsData, null, 2));
}

setInterval(cleanOldTempReviews, 10 * 60 * 1000);

Promise.all([initReviewsFile(), initJobsFile()]).then(() => {
  app.listen(port, () => {
    bot.start();
    console.log(`Server running on port ${port}`);
  });
});

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);