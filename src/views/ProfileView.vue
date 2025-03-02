<template>
  <div class="profile-container">
    <RouterLink to="/" class="back-btn">
      <img src="https://i.postimg.cc/PxR6j6Rc/BFF14-B15-FF7-A-41-A2-A7-AB-AC75-B7-DE5-FD7.png" alt="Back">
    </RouterLink>

    <div class="profile-content">
      <img
        :src="profileData.photoUrl"
        @error="handleAvatarError"
        class="profile-avatar"
      >
      <h1 class="profile-name">{{ profileData.firstName }}</h1>
    </div>

    <div class="reviews-section">
      <textarea
        v-model="reviewText"
        class="review-input"
        placeholder="Напишите ваш отзыв..."
      ></textarea>

      <button
        class="leave-review-btn"
        @click="initiatePayment"
        :disabled="!reviewText || isOwner"
      >
        Оплатить 1★ и отправить
      </button>

      <div v-if="allReviews.length === 0" class="no-reviews">
        Пока отзывов нет, вы можете быть первым!
      </div>

      <div v-else class="reviews-list">
        <div v-for="(review, index) in allReviews" :key="index" class="review-message">
          <div class="message-content">
            {{ review.text }}
          </div>
          <div class="message-date">
            {{ new Date(review.date).toLocaleString() }}
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
const userId = computed(() => route.params.userId?.toString());
const currentUser = Telegram.WebApp.initDataUnsafe.user;

const profileData = ref({ firstName: '', photoUrl: '', username: '' });
const allReviews = ref([]);
const reviewText = ref('');

const isOwner = computed(() => {
  return currentUser?.id?.toString() === userId.value;
});

const handleAvatarError = (e) => {
  e.target.src = `https://t.me/i/userpic/160/${route.query.username}.jpg`;
};

const loadProfileData = async () => {
  try {
    if (!userId.value) return;

    const response = await fetch(`/api/user/${userId.value}`, {
      headers: {
        'X-Telegram-Data': Telegram.WebApp.initData
      }
    });

    const data = await response.json();
    profileData.value = data;
  } catch {
    profileData.value.photoUrl = currentUser?.photo_url
      || `https://t.me/i/userpic/160/${route.query.username}.jpg`;
  }
};

const loadReviews = async () => {
  try {
    const response = await fetch(`/api/reviews?targetUserId=${userId.value}`);
    allReviews.value = await response.json();
  } catch (error) {
    console.error("Ошибка загрузки отзывов:", error);
  }
};

const initiatePayment = async () => {
  try {
    const response = await fetch('/api/createInvoiceLink', {
      method: 'POST',
      headers: {
        'X-Telegram-Data': Telegram.WebApp.initData,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: reviewText.value,
        targetUserId: userId.value
      })
    });

    const { invoiceLink } = await response.json();
    Telegram.WebApp.openInvoice(invoiceLink, (status) => {
      if (status === 'paid') {
        loadReviews();
        reviewText.value = '';
      }
    });
  } catch (error) {
    Telegram.WebApp.showAlert(error.message);
  }
};

onMounted(() => {
  Telegram.WebApp.ready();
  Telegram.WebApp.expand();
  loadProfileData();
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
  margin-top: 20px;
}

.profile-avatar {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  border: 3px solid #97f492;
  box-shadow: 0 0 30px rgba(151, 244, 146, 0.3);
}

.profile-name {
  color: #fff;
  font-size: 25px;
  margin-top: 15px;
}

.reviews-section {
  margin-top: 20px;
  padding: 20px;
  background: rgba(255,255,255,0.1);
  border-radius: 12px;
}

.review-input {
  width: 100%;
  height: 70px;
  margin-bottom: 20px;
  padding: 15px;
  background: rgba(255,255,255,0.1);
  border: 1px solid #97f492;
  border-radius: 12px;
  color: white;
}

.leave-review-btn {
  background: linear-gradient(45deg, #97f492, #6adf66);
  border: none;
  padding: 12px 24px;
  border-radius: 25px;
  color: #182038;
  font-weight: 600;
  cursor: pointer;
}

.leave-review-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.no-reviews {
  color: #97f492;
  text-align: center;
  padding: 20px;
  opacity: 0.7;
}

.reviews-list {
  max-height: 400px;
  overflow-y: auto;
}

.review-message {
  background: rgba(255,255,255,0.05);
  padding: 15px;
  border-radius: 12px;
  margin-bottom: 15px;
}

.message-content {
  color: #fff;
}

.message-date {
  color: #97f492;
  font-size: 0.8em;
  text-align: right;
  margin-top: 8px;
}
</style>