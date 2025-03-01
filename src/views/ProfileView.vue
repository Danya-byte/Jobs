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

        <div class="reviews-section">
            <button class="leave-review-btn" @click="initiatePayment">
                Оставить отзыв (10 Stars)
            </button>

            <div class="reviews-list">
                <div v-for="(review, index) in reviews" :key="index" class="review-card">
                    <div class="review-header">
                        <img :src="review.authorPhoto" class="review-avatar">
                        <span class="review-author">@{{ review.author }}</span>
                    </div>
                    <p class="review-text">{{ review.text }}</p>
                    <div class="review-rating">
                        Оценка: {{ review.rating }}/5
                        <span class="review-date">{{ formatDate(review.timestamp) }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const loaded = ref(false);
const userPhoto = ref('');
const username = ref('');
const reviews = ref([]);
const paymentAllowed = ref(false);

const currentUser = computed(() => {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || {};
});

const userId = computed(() => route.params.userId);

const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString();
};

const loadReviews = async () => {
    try {
        const allKeys = await new Promise((resolve) => {
            Telegram.WebApp.CloudStorage.getKeys((error, keys) => {
                if (error) {
                    console.error('Error getting keys:', error);
                    resolve([]);
                } else {
                    resolve(keys);
                }
            });
        });

        const reviewKeys = allKeys.filter(key =>
            key.startsWith(`review_${userId.value}_`)
        );

        if (reviewKeys.length > 0) {
            Telegram.WebApp.CloudStorage.getItems(reviewKeys, (error, items) => {
                if (error) {
                    console.error('Error loading reviews:', error);
                    return;
                }
                reviews.value = Object.values(items)
                    .map(item => JSON.parse(item))
                    .sort((a, b) => b.timestamp - a.timestamp);
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
};

const saveReview = async (reviewText, rating) => {
    const reviewKey = `review_${userId.value}_${Date.now()}`;
    const reviewData = {
        author: currentUser.value.username,
        authorPhoto: currentUser.value.photo_url,
        text: reviewText,
        rating: rating,
        timestamp: Date.now()
    };

    Telegram.WebApp.CloudStorage.setItem(
        reviewKey,
        JSON.stringify(reviewData),
        (error, success) => {
            if (error) {
                Telegram.WebApp.showAlert(`Ошибка сохранения: ${error}`);
            } else if (success) {
                loadReviews();
                Telegram.WebApp.showAlert('Отзыв успешно опубликован!');
            }
        }
    );
};

const initiatePayment = () => {
    if (!paymentAllowed.value) {
        window.Telegram.WebApp.sendInvoice({
            title: 'Оставить отзыв',
            description: 'Публикация отзыва для пользователя',
            currency: 'XTR',
            prices: [{ label: 'Отзыв', amount: 1000 }],
            payload: JSON.stringify({
                type: 'review',
                targetUserId: userId.value
            })
        });
    } else {
        showReviewForm();
    }
};

const handlePaymentSuccess = () => {
    paymentAllowed.value = true;
    showReviewForm();
};

const showReviewForm = () => {
    Telegram.WebApp.showPopup({
        title: 'Написать отзыв',
        message: 'Оцените пользователя от 1 до 5 звезд:',
        buttons: [
            { type: 'default', text: '★ 1' },
            { type: 'default', text: '★ 2' },
            { type: 'default', text: '★ 3' },
            { type: 'default', text: '★ 4' },
            { type: 'default', text: '★ 5' },
        ]
    }, (buttonId) => {
        const rating = buttonId + 1;
        Telegram.WebApp.showPopup({
            title: 'Напишите отзыв',
            message: 'Введите текст отзыва (макс. 200 символов):',
            input: 'text'
        }, (text) => {
            if (text.length > 200) {
                Telegram.WebApp.showAlert('Слишком длинный отзыв!');
                return;
            }
            saveReview(text, rating);
        });
    });
};

onMounted(() => {
    Telegram.WebApp.onEvent('invoiceClosed', (eventData) => {
        if (eventData.status === 'paid') {
            handlePaymentSuccess();
        }
    });

    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const user = Telegram.WebApp.initDataUnsafe.user;
        userPhoto.value = user.photo_url;
        username.value = user.username || 'user_' + user.id.toString().slice(-4);
    }

    loadReviews();
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
    background: #1a2233;
    border-radius: 15px;
}

.leave-review-btn {
    background: linear-gradient(135deg, #97f492, #6de06a);
    color: #000;
    padding: 12px 25px;
    border-radius: 25px;
    border: none;
    cursor: pointer;
    font-weight: 600;
    margin-bottom: 20px;
    transition: transform 0.3s;
}

.leave-review-btn:hover {
    transform: scale(1.05);
}

.reviews-list {
    display: grid;
    gap: 15px;
}

.review-card {
    background: #182038;
    padding: 15px;
    border-radius: 12px;
    border: 1px solid #2d3540;
}

.review-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}

.review-avatar {
    width: 35px;
    height: 35px;
    border-radius: 50%;
}

.review-author {
    color: #97f492;
    font-weight: 500;
}

.review-text {
    color: #c2c6cf;
    line-height: 1.4;
}

.review-rating {
    color: #6de06a;
    margin-top: 10px;
    font-size: 0.9em;
}

.review-date {
    color: #6de06a;
    font-size: 0.8em;
    margin-left: 10px;
    opacity: 0.7;
}
</style>