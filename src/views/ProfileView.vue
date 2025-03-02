<template>
  <div class="profile-container" @click="handleClickOutside">
    <RouterLink to="/" class="back-btn">
      <img src="https://i.postimg.cc/PxR6j6Rc/BFF14-B15-FF7-A-41-A2-A7-AB-AC75-B7-DE5-FD7.png" alt="Back">
    </RouterLink>

    <div class="profile-content">
      <img
        :src="profileData.photoUrl || 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp'"
        class="profile-avatar"
        @load="startAnimation"
        :class="{'avatar-visible': loaded}"
      >
      <h1 class="profile-name">{{ profileData.firstName }}</h1>
    </div>

    <div class="reviews-section">
      <textarea
        v-model="reviewText"
        class="review-input"
        placeholder="Напишите ваш отзыв..."
        @click.stop
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
        <div v-for="(review, index) in allReviews.slice().reverse()" :key="index" class="review-message">
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
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const userId = route.params.userId;
const currentUser = Telegram.WebApp.initDataUnsafe.user;

const loaded = ref(false);
const profileData = ref({ firstName: '', photoUrl: '' });
const allReviews = ref([]);
const reviewText = ref('');

const isOwner = computed(() => {
  return currentUser?.id?.toString() === userId?.toString();
});

const handleClickOutside = () => {
  Telegram.WebApp.closeScanQrPopup();
};

const loadProfileData = async () => {
  try {
    const response = await fetch(`https://impotently-dutiful-hare.cloudpub.ru/api/user/${userId}`, {
      headers: {
        "Cache-Control": "no-cache",
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    if (response.status === 404) {
      Telegram.WebApp.showAlert("Профиль не найден");
      router.push("/");
      return;
    }

    if (!response.ok) throw new Error("Ошибка HTTP: " + response.status);

    const data = await response.json();
    profileData.value = data;
  } catch (error) {
    console.error("Ошибка загрузки профиля:", error);
    Telegram.WebApp.showAlert("Ошибка загрузки");
    router.push("/");
  }
};

const loadReviews = async () => {
  try {
    const response = await fetch(`https://impotently-dutiful-hare.cloudpub.ru/api/reviews?targetUserId=${userId}`);
    const data = await response.json();
    allReviews.value = data;
  } catch (error) {
    console.error("Ошибка загрузки отзывов:", error);
  }
};

const initiatePayment = async () => {
  try {
    const response = await fetch('https://impotently-dutiful-hare.cloudpub.ru/api/createInvoiceLink', {
      method: 'POST',
      headers: {
        'X-Telegram-Data': Telegram.WebApp.initData,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: reviewText.value, targetUserId: userId })
    });

    if (!response.ok) throw new Error('Ошибка создания платежа');

    const { invoiceLink } = await response.json();

    Telegram.WebApp.openInvoice(invoiceLink, (status) => {
      if (status === 'paid') {
        loadReviews();
        reviewText.value = '';
        Telegram.WebApp.showAlert('Отзыв успешно отправлен!');
      }
    });
  } catch (error) {
    Telegram.WebApp.showAlert(error.message);
  }
};

onMounted(() => {
  if (window.Telegram?.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
    loadProfileData();
    loadReviews();
  }
});
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
  margin-top: 20px;
}

.profile-avatar {
  width: 90px;
  height: 90px;
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
  font-size: 25px;
  margin-top: 15px;
  text-shadow: 0 4px 10px rgba(151, 244, 146, 0.2);
}

.reviews-section {
  margin-top: 20px;
  padding: 20px;
  background: rgba(255,255,255,0.1);
  border-radius: 12px;
  height: calc(100vh - 260px);
  display: flex;
  flex-direction: column;
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
  resize: none;
  overflow: hidden;
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
  margin-bottom: 20px;
}

.leave-review-btn:hover {
  transform: scale(1.05);
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
  flex-grow: 1;
  overflow-y: auto;
  padding-right: 12px;
}

.reviews-list::-webkit-scrollbar {
  width: 0;
  background: transparent;
}

.reviews-list {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.review-message {
  background: rgba(255,255,255,0.05);
  padding: 15px;
  border-radius: 12px;
  margin-bottom: 15px;
}

.message-content {
  color: #fff;
  margin: 0;
  line-height: 1.4;
}

.message-date {
  color: #97f492;
  font-size: 0.8em;
  text-align: right;
  margin-top: 8px;
}
</style>