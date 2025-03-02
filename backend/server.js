const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const app = express();

// Настройка CORS
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = ['https://jobs-iota-one.vercel.app', 'http://localhost:5173']; // Добавьте свои домены
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-Telegram-Data'],
};
app.use(cors(corsOptions));
app.use(express.json());

const BOT_TOKEN = "7745513073:AAHn69lYwvKBx-gXn7fKBevLnnDZzXp1lrY";
const REVIEWS_FILE = path.join(__dirname, 'reviews.json');

// Инициализация файла отзывов
async function initReviewsFile() {
    try {
        await fs.access(REVIEWS_FILE);
    } catch {
        await fs.writeFile(REVIEWS_FILE, '{}');
    }
}

// Валидация данных Telegram
function validateTelegramData(initData) {
    try {
        console.log("📌 Валидация Telegram-данных:", initData);
        const params = new URLSearchParams(initData);
        const receivedHash = params.get('hash');
        params.delete('hash'); // Удаляем hash для формирования checkString

        if (!receivedHash || !params.get('auth_date') || !params.get('user')) {
            console.error("⚠️ Отсутствуют обязательные параметры");
            return false;
        }

        const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
        const checkString = Array.from(params.entries())
            .map(([key, value]) => `${key}=${value}`)
            .sort()
            .join('\n');

        console.log("🔹 Check String:", checkString);
        const calculatedHash = crypto.createHmac('sha256', secretKey)
            .update(checkString)
            .digest('hex');

        console.log("🔹 Calculated Hash:", calculatedHash);
        console.log("🔹 Received Hash:", receivedHash);

        return calculatedHash === receivedHash;
    } catch (e) {
        console.error("⚠️ Ошибка в validateTelegramData:", e);
        return false;
    }
}

// Эндпоинт для получения отзывов
app.get('/reviews', async (req, res) => {
    try {
        const { user_id } = req.query;
        if (!user_id) {
            return res.status(400).json({ error: 'Missing user_id' });
        }

        const reviewsData = await fs.readFile(REVIEWS_FILE, 'utf8');
        const reviews = JSON.parse(reviewsData);
        const userReviews = reviews[user_id] || [];
        res.json(userReviews);
    } catch (error) {
        console.error('Ошибка при получении отзывов:', error);
        res.status(500).json({ error: 'Failed to load reviews' });
    }
});

// Эндпоинт для создания инвойса
app.post('/create-invoice', async (req, res) => {
    try {
        const telegramData = req.headers['x-telegram-data'];
        console.log("🔹 Полученные данные от Telegram:", telegramData);

        if (!validateTelegramData(telegramData)) {
            console.error("❌ Ошибка валидации Telegram-данных");
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const params = new URLSearchParams(telegramData);
        const user = JSON.parse(params.get('user'));
        const orderId = `${user.id}_${Date.now()}`;

        console.log("📨 Запрос к Telegram API: createInvoiceLink");
        const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
            title: "Публикация отзыва",
            description: "Размещение отзыва в профиле пользователя",
            currency: "XTR",
            prices: [{ label: "1 Telegram Star", amount: 1 }],
            payload: Buffer.from(JSON.stringify({ user_id: user.id, order_id: orderId })).toString('base64'),
            provider_token: "",
            photo_url: "https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp",
            max_tip_amount: 0
        });

        console.log("📩 Ответ от Telegram API:", response.data);
        res.json({ invoice_link: response.data.result });
    } catch (error) {
        console.error("❌ Ошибка при создании инвойса:", error.response?.data || error.message);
        res.status(500).json({ error: error.message });
    }
});

// Эндпоинт для отправки отзыва
app.post('/submit-review', async (req, res) => {
    try {
        const telegramData = req.headers['x-telegram-data'];
        if (!validateTelegramData(telegramData)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const { text, user_id } = req.body;
        if (!text || !user_id) {
            return res.status(400).json({ error: 'Missing text or user_id' });
        }

        const reviewsData = await fs.readFile(REVIEWS_FILE, 'utf8');
        const reviews = JSON.parse(reviewsData);
        if (!reviews[user_id]) reviews[user_id] = [];
        reviews[user_id].push({ text, date: new Date().toISOString() });

        await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviews, null, 2));
        res.sendStatus(200);
    } catch (error) {
        console.error('Ошибка при сохранении отзыва:', error);
        res.status(500).json({ error: 'Failed to submit review' });
    }
});

// Webhook для обработки платежей
app.post('/webhook', async (req, res) => {
    try {
        console.log("📩 Webhook вызван:", req.body);
        const { message } = req.body;

        if (message?.successful_payment) {
            console.log("✅ Успешный платёж:", message.successful_payment);
            const payload = JSON.parse(
                Buffer.from(message.successful_payment.invoice_payload, 'base64').toString()
            );
            console.log("🔹 Расшифрованный payload:", payload);
        }
        res.sendStatus(200);
    } catch (error) {
        console.error("❌ Ошибка в Webhook:", error);
        res.status(500).json({ error: error.message });
    }
});

// Запуск сервера
initReviewsFile().then(() => {
    app.listen(3000, () => console.log('🚀 Сервер запущен на порту 3000'));
});