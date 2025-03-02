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
        if (!data.hash || !data.auth_date || !data.user) {
            return false;
        }

        const decodedUser = decodeURIComponent(data.user);
        const checkParams = [
            ['auth_date', data.auth_date],
            ['user', decodedUser]
        ];
        if (data.query_id) checkParams.push(['query_id', data.query_id]);

        checkParams.sort((a, b) => a[0].localeCompare(b[0]));
        const checkString = checkParams.map(([key, val]) => `${key}=${val}`).join('\n');

        const secretKey = crypto.createHmac('sha256', 'WebAppData')
                             .update(BOT_TOKEN)
                             .digest();

        const generatedHash = crypto.createHmac('sha256', secretKey)
                                  .update(checkString)
                                  .digest('hex');

        return generatedHash === data.hash;
    } catch (e) {
        return false;
    }
}

app.post('/create-invoice', async (req, res) => {
    try {
        if (!req.headers['x-telegram-data']) {
            return res.status(401).send('Authorization required');
        }

        const telegramData = new URLSearchParams(req.headers['x-telegram-data']);
        const dataObject = Object.fromEntries(telegramData);

        if (!validateTelegramData(dataObject)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const payload = {
            user_id: dataObject.user?.id,
            temp_data: Date.now()
        };

        if (!payload.user_id) {
            return res.status(400).send('User ID is required');
        }

        const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
            title: "Оставить отзыв",
            description: "Публикация отзыва в профиле",
            currency: "XTR",
            prices: [{ label: "Отзыв", amount: 1 }],
            payload: Buffer.from(JSON.stringify(payload)).toString('base64')
        });

        res.json({ invoice_link: response.data.result });
    } catch (error) {
        res.status(500).send('Internal server error');
    }
});

app.post('/submit-review', async (req, res) => {
    try {
        const telegramData = new URLSearchParams(req.headers['x-telegram-data']);
        const dataObject = Object.fromEntries(telegramData);
        if (!validateTelegramData(dataObject)) return res.status(401).send('Invalid data');

        const review = {
            text: req.body.text,
            author: dataObject.user?.first_name || 'Аноним',
            author_photo: dataObject.user?.photo_url,
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