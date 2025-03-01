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
        <h1 class="profile-name">@{{ username }}</h1>
    </div>

    <div class="reviews-section">
        <div class="add-review">
            <textarea v-model="newReview" placeholder="Написать отзыв..."></textarea>
            <button @click="openPaymentModal">Опубликовать (1★)</button>
        </div>

        <div class="reviews-list">
            <div v-for="(review, index) in paidReviews" :key="index" class="review-item">
                <div class="review-header">
                    <img :src="review.authorPhoto" class="review-avatar">
                    <span class="review-author">@{{ review.authorName }}</span>
                </div>
                <p class="review-text">{{ review.text }}</p>
            </div>
        </div>
    </div>
</div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';

const loaded = ref(false);
const userPhoto = ref('');
const username = ref('');
const newReview = ref('');
const allReviews = ref([]);

const paidReviews = computed(() =>
    allReviews.value.filter(review => review.paid)
);

const loadReviews = async () => {
    const result = await Telegram.WebApp.CloudStorage.getKeys();
    if (result?.keys) {
        allReviews.value = await Promise.all(
            result.keys
                .filter(key => key.startsWith(`review_${username.value}_`))
                .map(async key => {
                    const item = await Telegram.WebApp.CloudStorage.getItem(key);
                    return JSON.parse(item);
                })
        );
    }
};

const openPaymentModal = async () => {
    if (!newReview.value.trim()) return;

    Telegram.WebApp.showPopup({
        title: 'Оплата отзыва',
        message: 'Для публикации отзыва требуется 1 Telegram Star',
        buttons: [{
            id: 'pay',
            type: 'ok',
            text: 'Оплатить 1★'
        }, {
            type: 'cancel'
        }]
    }, async (buttonId) => {
        if (buttonId === 'pay') {
            Telegram.WebApp.openInvoice({
                title: 'Публикация отзыва',
                description: 'Оплата 1 Telegram Star за публикацию',
                currency: 'XTR',
                prices: [{ label: 'Отзыв', amount: 100 }]
            }, (status) => {
                if (status === 'paid') handlePaidReview();
            });
        }
    });
};

const handlePaidReview = async () => {
    const review = {
        id: `review_${username.value}_${Date.now()}`,
        text: newReview.value,
        authorName: username.value,
        authorPhoto: userPhoto.value,
        paid: true,
        timestamp: Date.now()
    };

    await Telegram.WebApp.CloudStorage.setItem(review.id, JSON.stringify(review));
    allReviews.value.unshift(review);
    newReview.value = '';
};

onMounted(() => {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const user = Telegram.WebApp.initDataUnsafe.user;
        userPhoto.value = user.photo_url;
        username.value = user.username;
        loadReviews();
    }
});
</script>

<style scoped>
.profile-container {
    background: linear-gradient(-45deg, #101622, #182038);
    min-height: 100vh;
    padding: 30px 20px;
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
    width: 150px;
    height: 150px;
    border-radius: 50%;
    border: 3px solid transparent;
    box-shadow: 0 0 30px rgba(151, 244, 146, 0.3);
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    animation: border-rotate 3s infinite linear;
}

@keyframes border-rotate {
    0% {
        border-color: #97f492;
        filter: hue-rotate(0deg);
    }
    100% {
        border-color: #97f492;
        filter: hue-rotate(360deg);
    }
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
}

.add-review textarea {
    width: 100%;
    height: 100px;
    padding: 10px;
    margin-bottom: 10px;
    background: #1a2233;
    border: 1px solid #2d3540;
    color: white;
    border-radius: 8px;
    resize: none;
}

.add-review button {
    background: #97f492;
    color: #000;
    padding: 8px 20px;
    border-radius: 20px;
    border: none;
    cursor: pointer;
    font-weight: 600;
    transition: transform 0.2s;
}

.add-review button:hover {
    transform: translateY(-2px);
}

.reviews-list {
    margin-top: 20px;
}

.review-item {
    background: #1a2233;
    padding: 15px;
    border-radius: 12px;
    margin-bottom: 15px;
    border: 1px solid #2d3540;
}

.review-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}

.review-avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px solid #97f492;
}

.review-author {
    color: #97f492;
    font-size: 14px;
    font-weight: 500;
}

.review-text {
    color: #e0e0e0;
    margin: 0;
    line-height: 1.5;
    font-size: 14px;
}
</style>