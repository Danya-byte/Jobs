const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const app = express();
app.use(express.json());

const BOT_TOKEN ="7745513073:AAHn69lYwvKBx-gXn7fKBevLnnDZzXp1lrY";
const CLOUDPUB_URL = 'https://impotently-dutiful-hare.cloudpub.ru';

function validateTelegramData(data) {
    const secret = crypto.createHash('sha256').update(BOT_TOKEN).digest();
    const checkString = Object.keys(data)
        .filter(key => key !== 'hash')
        .sort()
        .map(key => `${key}=${data[key]}`)
        .join('\n');
    return crypto.createHmac('sha256', secret).update(checkString).digest('hex') === data.hash;
}

app.post('/create-invoice', async (req, res) => {
    const telegramData = Object.fromEntries(new URLSearchParams(req.headers['x-telegram-data']));
    if (!validateTelegramData(telegramData)) return res.status(401).send('Invalid data');

    try {
        const { data } = await axios.post(`${BOT_TOKEN}/createInvoiceLink`, {
            title: "Отзыв за 1★",
            description: "Публикация отзыва",
            currency: "XTR",
            prices: [{ label: "Отзыв", amount: 1 }],
            payload: Buffer.from(JSON.stringify({ user_id: telegramData.user?.id })).toString('base64')
        });

        await axios.post(`${CLOUDPUB_URL}/invoices`, {
            invoice_id: data.result,
            user_id: telegramData.user?.id
        });

        res.json({ invoice_link: data.result });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/webhook', async (req, res) => {
    if (req.body.message?.successful_payment) {
        const payload = JSON.parse(Buffer.from(req.body.message.successful_payment.invoice_payload, 'base64').toString());
        await axios.post(`${CLOUDPUB_URL}/reviews`, {
            user_id: payload.user_id,
            text: req.body.message.text,
            author: req.body.message.from.first_name
        });
    }
    res.sendStatus(200);
});

app.get('/reviews', async (req, res) => {
    try {
        const response = await axios.get(`${CLOUDPUB_URL}/reviews`);
        res.json(response.data);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.listen(3000, () => console.log('Server started on port 3000'));