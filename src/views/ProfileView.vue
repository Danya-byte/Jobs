<template>
  <div class="profile-container" @click="handleClickOutside">
    <RouterLink to="/" class="back-btn">
      <img src="https://i.postimg.cc/PxR6j6Rc/BFF14-B15-FF7-A-41-A2-A7-AB-AC75-B7-DE5-FD7.png" alt="Back">
    </RouterLink>

    <div class="profile-content">
      <img
        :src="profileData.photoUrl"
        @error="handleAvatarError"
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
import axios from 'axios';

const route = useRoute();
const router = useRouter();
const currentUser = ref(null);
const userId = ref('');

const loaded = ref(false);
const profileData = ref({ firstName: '', photoUrl: '', username: '' });
const allReviews = ref([]);
const reviewText = ref('');

const isOwner = computed(() => {
  return currentUser.value?.id?.toString() === userId.value?.toString();
});

const handleClickOutside = () => {
  Telegram.WebApp.closeScanQrPopup();
};

const handleAvatarError = (e) => {
  const fallbackAvatar = 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp';
  e.target.src = fallbackAvatar;
};

const loadProfileData = async () => {
  try {
    const response = await axios.get(`/api/user/${userId.value}`);
    profileData.value = response.data;
  } catch (error) {
    console.error("Ошибка загрузки профиля", error);
  }
};

const loadReviews = async () => {
  try {
    const response = await axios.get(`/api/reviews?targetUserId=${userId.value}`);
    allReviews.value = response.data;
  } catch (error) {
    console.error("Ошибка загрузки отзывов", error);
  }
};

const initiatePayment = async () => {
  try {
    const response = await axios.post('/api/createInvoiceLink', {
      text: reviewText.value,
      targetUserId: userId.value
    }, {
      headers: { 'X-Telegram-Data': Telegram.WebApp.initData }
    });

    const { invoiceLink } = response.data;
    Telegram.WebApp.openInvoice(invoiceLink, async (status) => {
      if (status === 'cancelled') {
        Telegram.WebApp.showAlert('Вы не подтвердили платеж!');
      }
      if (status === 'paid') {
        await loadReviews();
        reviewText.value = '';
        Telegram.WebApp.showAlert('Отзыв успешно отправлен!');
      }
    });
  } catch (error) {
    Telegram.WebApp.showAlert('Ошибка при создании платежа');
  }
};

onMounted(async () => {
  currentUser.value = Telegram.WebApp.initDataUnsafe?.user;
  userId.value = route.params.userId || currentUser.value?.id;
  if (!userId.value) {
    router.push('/');
    return;
  }
  await loadProfileData();
  await loadReviews();
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
}

.profile-name {
  color: #fff;
  font-size: 25px;
  margin-top: 15px;
}
</style>
