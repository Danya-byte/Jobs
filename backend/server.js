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
        if (!data.hash || !data.auth_date || !data.user) return false;

        const secret = crypto.createHmac('sha256', 'WebAppData')
                           .update(BOT_TOKEN)
                           .digest();

        const params = new URLSearchParams();
        params.append('auth_date', data.auth_date);
        params.append('user', decodeURIComponent(data.user));
        if (data.query_id) params.append('query_id', data.query_id);

        const checkString = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, val]) => `${key}=${val}`)
            .join('\n');

        return crypto.createHmac('sha256', secret)
                   .update(checkString)
                   .digest('hex') === data.hash;
    } catch (e) {
        return false;
    }
}

app.post('/create-invoice', async (req, res) => {
    try {
        const telegramData = Object.fromEntries(new URLSearchParams(req.headers['x-telegram-data']));

        if (!validateTelegramData(telegramData)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const user = JSON.parse(decodeURIComponent(telegramData.user));
        const payload = {
            user_id: user.id,
            timestamp: Date.now()
        };

        const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
            title: "Публикация отзыва",
            description: "Размещение отзыва в вашем профиле",
            currency: "XTR",
            prices: [{ label: "Отзыв", amount: 1 }],
            payload: Buffer.from(JSON.stringify(payload)).toString('base64'),
            provider_token: ""
        });

        res.json({ invoice_link: response.data.result });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/submit-review', async (req, res) => {
    try {
        const telegramData = Object.fromEntries(new URLSearchParams(req.headers['x-telegram-data']));
        if (!validateTelegramData(telegramData)) return res.status(401).send('Invalid data');

        const review = {
            text: req.body.text,
            author: JSON.parse(decodeURIComponent(telegramData.user)).first_name || 'Аноним',
            author_photo: JSON.parse(decodeURIComponent(telegramData.user)).photo_url,
            date: new Date().toISOString()
        };

        const reviewsData = JSON.parse(await fs.readFile(REVIEWS_FILE));
        const userId = req.body.user_id;

        if (!reviewsData[userId]) reviewsData[userId] = [];
        reviewsData[userId].push(review);

        await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviewsData, null, 2));
        res.sendStatus(200);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.get('/reviews', async (req, res) => {
    try {
        const userId = req.query.user_id;
        const reviewsData = JSON.parse(await fs.readFile(REVIEWS_FILE));
        res.json(reviewsData[userId] || []);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/webhook', async (req, res) => {
    if (req.body.message?.successful_payment) {
        console.log('Успешный платеж:', req.body.message.successful_payment);
    }
    res.sendStatus(200);
});

initReviewsFile().then(() => {
    app.listen(3000, () => console.log('Сервер запущен на порту 3000'));
});