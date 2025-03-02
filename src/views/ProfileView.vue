<template>
<div class="profile-container">
    <RouterLink to="/" class="back-btn">
        <img src="https://i.postimg.cc/PxR6j6Rc/BFF14-B15-FF7-A-41-A2-A7-AB-AC75-B7-DE5-FD7.png" alt="Back">
    </RouterLink>

    <div class="profile-content">
        <img
            :src="userPhoto || 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp'"
            class="profile-avatar"
            @load="startAnimation"
            :class="{'avatar-visible': loaded}"
        >
        <h1 class="profile-name">{{ userFirstName }}</h1>
    </div>

    <div class="reviews-section">
        <button class="leave-review-btn" @click="initiatePayment">
            Оставить отзыв за 1★
        </button>
        <div v-if="reviews.length === 0" class="no-reviews">
            Пока отзывов нет, вы можете быть первым!
        </div>
        <div v-else class="reviews-list">
            <div v-for="(review, index) in reviews" :key="index" class="review-item">
                <img :src="review.author_photo || 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp'" class="review-avatar">
                <div class="review-content">
                    <div class="review-header">
                        <span class="review-author">{{ review.author }}</span>
                        <span class="review-date">{{ new Date(review.date).toLocaleDateString() }}</span>
                    </div>
                    <p class="review-text">{{ review.text }}</p>
                </div>
            </div>
        </div>
    </div>
</div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const loaded = ref(false);
const userPhoto = ref('');
const userFirstName = ref('');
const reviews = ref([]);

onMounted(() => {
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
        loadReviews();
    }

    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const user = Telegram.WebApp.initDataUnsafe.user;
        userPhoto.value = user.photo_url;
        userFirstName.value = user.first_name || '';
    }
});

const startAnimation = () => loaded.value = true;

const initiatePayment = async () => {
    try {
        console.log('Sending Telegram Data:', Telegram.WebApp.initData);
        const response = await fetch('https://impotently-dutiful-hare.cloudpub.ru/create-invoice', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Data': Telegram.WebApp.initData
            },
            body: JSON.stringify({ user_id: Telegram.WebApp.initDataUnsafe.user?.id })
        });

        if (response.status === 401) {
            Telegram.WebApp.showAlert('Сессия устарела. Перезагрузите страницу');
            return;
        }

        if (!response.ok) throw new Error('Ошибка сервера');
        const { invoice_link } = await response.json();
        Telegram.WebApp.openInvoice(invoice_link, { test: true });

    } catch (error) {
        console.error('Ошибка платежа:', error);
        Telegram.WebApp.showAlert(`Ошибка: ${error.message}`);
    }
};

const loadReviews = async () => {
    try {
        const userId = Telegram.WebApp.initDataUnsafe.user?.id;
        const response = await fetch(`https://impotently-dutiful-hare.cloudpub.ru/reviews?user_id=${userId}`);
        reviews.value = await response.json();
    } catch (error) {
        console.error('Ошибка загрузки отзывов:', error);
    }
};

Telegram.WebApp.onEvent('invoiceClosed', (status) => {
    if (status === 'paid') {
        Telegram.WebApp.showPopup({
            title: 'Напишите отзыв',
            message: 'Введите текст вашего отзыва:',
            buttons: [{
                type: 'default',
                text: 'Отправить',
                id: 'submit'
            }]
        }, (buttonId) => {
            if (buttonId === 'submit') {
                const reviewText = Telegram.WebApp.popupParams.value;
                submitReview(reviewText);
            }
        });
    }
});

const submitReview = async (text) => {
    try {
        const response = await fetch('https://impotently-dutiful-hare.cloudpub.ru/submit-review', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Data': Telegram.WebApp.initData
            },
            body: JSON.stringify({
                text: text,
                user_id: Telegram.WebApp.initDataUnsafe.user?.id
            })
        });

        if (response.ok) loadReviews();
    } catch (error) {
        console.error('Ошибка отправки отзыва:', error);
    }
};
</script>

<style scoped>
.profile-container {
    background: linear-gradient(-45deg, #101622, #182038);
    min-height: 100vh;
    padding: 30px 20px;
    overflow: hidden;
}

.back-btn img {
    width: 30px;
    height: 30px;
    filter: invert(1);
    transition: transform 0.3s ease;
}

.back-btn:hover img {
    transform: translateX(-5px);
}

.profile-content {
    text-align: center;
    margin-top: 50px;
}

.profile-avatar {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    border: 3px solid transparent;
    box-shadow: 0 0 30px rgba(151, 244, 146, 0.3);
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    animation: border-rotate 3s infinite linear;
}

@keyframes border-rotate {
    0% { border-color: #97f492; filter: hue-rotate(0deg); }
    100% { border-color: #97f492; filter: hue-rotate(360deg); }
}

.avatar-visible {
    opacity: 1;
    transform: translateY(0);
}

.profile-name {
    color: #fff;
    font-size: 28px;
    margin-top: 25px;
    text-shadow: 0 4px 10px rgba(151, 244, 146, 0.2);
}

.reviews-section {
    margin-top: 40px;
    padding: 20px;
    background: rgba(255,255,255,0.1);
    border-radius: 12px;
}

.leave-review-btn {
    background: linear-gradient(45deg, #97f492, #6adf66);
    border: none;
    padding: 12px 24px;
    border-radius: 25px;
    color: #182038;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s;
}

.leave-review-btn:hover {
    transform: scale(1.05);
}

.no-reviews {
    color: #97f492;
    text-align: center;
    padding: 20px;
    opacity: 0.7;
}

.reviews-list {
    margin-top: 20px;
}

.review-item {
    display: flex;
    gap: 15px;
    background: rgba(255,255,255,0.05);
    padding: 15px;
    border-radius: 12px;
    margin-bottom: 15px;
}

.review-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
}

.review-content {
    flex-grow: 1;
}

.review-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
}

.review-author {
    color: #97f492;
    font-weight: 500;
}

.review-date {
    color: #aaa;
    font-size: 0.8em;
}

.review-text {
    color: #fff;
    margin: 0;
    line-height: 1.4;
}
</style>