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
}

.add-review button {
    background: #97f492;
    color: #000;
    padding: 8px 20px;
    border-radius: 20px;
    border: none;
    cursor: pointer;
}

.reviews-list {
    margin-top: 20px;
}

.review-item {
    background: #1a2233;
    padding: 15px;
    border-radius: 12px;
    margin-bottom: 15px;
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
}

.review-author {
    color: #97f492;
    font-size: 14px;
}

.review-text {
    color: #fff;
    margin: 0;
}
</style>