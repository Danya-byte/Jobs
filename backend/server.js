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

        const secretKey = crypto.createHmac('sha256', 'WebAppData')
                              .update(BOT_TOKEN)
                              .digest();

        const checkParams = new URLSearchParams({
            auth_date: data.auth_date,
            user: data.user,
            ...(data.query_id && { query_id: data.query_id })
        });

        const checkString = Array.from(checkParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');

        const calculatedHash = crypto.createHmac('sha256', secretKey)
                                   .update(checkString)
                                   .digest('hex');

        return calculatedHash === data.hash;
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
        const orderId = `${user.id}_${Date.now()}`;

        const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
            title: "Публикация отзыва",
            description: "Размещение отзыва в профиле пользователя",
            currency: "XTR",
            prices: [{ label: "1 Telegram Star", amount: 1 }],
            payload: Buffer.from(JSON.stringify({
                user_id: user.id,
                order_id: orderId
            })).toString('base64'),
            provider_token: "",
            photo_url: "https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp",
            max_tip_amount: 0
        });

        res.json({ invoice_link: response.data.result });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/webhook', async (req, res) => {
    try {
        const { message } = req.body;

        if (message?.successful_payment) {
            const payload = JSON.parse(
                Buffer.from(message.successful_payment.invoice_payload, 'base64').toString()
            );

            const reviewsData = JSON.parse(await fs.readFile(REVIEWS_FILE));
            if (!reviewsData[payload.user_id]) {
                reviewsData[payload.user_id] = {
                    paid: true,
                    reviews: []
                };
            } else {
                reviewsData[payload.user_id].paid = true;
            }

            await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviewsData));
        }

        res.sendStatus(200);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/submit-review', async (req, res) => {
    try {
        const telegramData = Object.fromEntries(new URLSearchParams(req.headers['x-telegram-data']));
        if (!validateTelegramData(telegramData)) return res.status(401).send('Invalid data');

        const user = JSON.parse(decodeURIComponent(telegramData.user));
        const reviewsData = JSON.parse(await fs.readFile(REVIEWS_FILE));

        if (!reviewsData[user.id]?.paid) {
            return res.status(402).send('Payment required');
        }

        const review = {
            text: req.body.text,
            author: user.first_name || 'Аноним',
            author_photo: user.photo_url,
            date: new Date().toISOString()
        };

        reviewsData[user.id].reviews.push(review);
        reviewsData[user.id].paid = false;

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
        res.json(reviewsData[userId]?.reviews || []);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

initReviewsFile().then(() => {
    app.listen(3000, () => console.log('Сервер запущен на порту 3000'));
});