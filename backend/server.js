const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = "7745513073:AAHn69lYwvKBx-gXn7fKBevLnnDZzXp1lrY";
const REVIEWS_FILE = path.join(__dirname, 'reviews.json');

async function initReviewsFile() {
    try {
        await fs.access(REVIEWS_FILE);
    } catch {
        await fs.writeFile(REVIEWS_FILE, '{}');
    }
}

function validateTelegramData(data) {
    try {
        console.log("📌 Валидация Telegram-данных:", data);
        if (!data.hash || !data.auth_date || !data.user) {
            console.error("⚠️ Отсутствуют обязательные параметры");
            return false;
        }

        const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest(); // ✅ Исправленный ключ

        const checkString = `auth_date=${data.auth_date}\nuser=${data.user}${data.query_id ? `\nquery_id=${data.query_id}` : ''}`;
        console.log("🔹 Check String:", checkString);

        const calculatedHash = crypto.createHmac('sha256', secretKey)
                                    .update(checkString)
                                    .digest('hex');

        console.log("🔹 Calculated Hash:", calculatedHash);
        console.log("🔹 Received Hash:", data.hash);

        if (calculatedHash !== data.hash) {
            console.error("❌ Хэш не совпадает!");
            return false;
        }

        return true;
    } catch (e) {
        console.error("⚠️ Ошибка в validateTelegramData:", e);
        return false;
    }
}

app.post('/create-invoice', async (req, res) => {
    try {
        const telegramData = Object.fromEntries(new URLSearchParams(req.headers['x-telegram-data']));
        console.log("🔹 Полученные данные от Telegram:", telegramData);

        if (!validateTelegramData(telegramData)) {
            console.error("❌ Ошибка валидации Telegram-данных");
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const user = JSON.parse(decodeURIComponent(telegramData.user));
        console.log("✅ Пользователь прошёл валидацию:", user);
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
        console.error("❌ Ошибка при создании инвойса:", error);
        res.status(500).send(error.message);
    }
});

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
        res.status(500).send(error.message);
    }
});

initReviewsFile().then(() => {
    app.listen(3000, () => console.log('🚀 Сервер запущен на порту 3000'));
});
