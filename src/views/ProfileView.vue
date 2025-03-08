<template>
  <div class="profile-container" @click="handleClickOutside">
    <RouterLink to="/" class="back-btn">
      <div class="back-button-wrapper" @touchstart="handleTouchStart" @touchend="handleTouchEnd">
        <img
          src="https://i.postimg.cc/PxR6j6Rc/BFF14-B15-FF7-A-41-A2-A7-AB-AC75-B7-DE5-FD7.png"
          alt="Back"
          class="back-icon"
        >
        <span class="back-text">Назад</span>
      </div>
    </RouterLink>

    <div class="profile-content">
      <img
        :src="avatarSrc"
        class="profile-avatar"
        @error="handleAvatarError"
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
        <div v-for="review in allReviews" :key="review.reviewId" class="review-message">
          <div class="message-content">
            {{ review.text }}
          </div>
          <div class="message-date">
            {{ new Date(review.date).toLocaleString() }}
            <button
              v-if="isAdmin"
              @click.stop="deleteReview(review.id)"
              class="delete-btn"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const currentUser = ref(null);
const userId = ref('');
const loaded = ref(false);
const profileData = reactive({
  firstName: '',
  username: ''
});
const avatarSrc = ref('https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp');
const allReviews = ref([]);
const reviewText = ref('');
const isAdmin = ref(false);
const isTouched = ref(false);

const isOwner = computed(() => {
  return currentUser.value?.id?.toString() === userId.value?.toString();
});

const handleClickOutside = () => {
  Telegram.WebApp.closeScanQrPopup();
};

const handleAvatarError = () => {
  avatarSrc.value = 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp';
};

const handleTouchStart = () => {
  isTouched.value = true;
};

const handleTouchEnd = () => {
  setTimeout(() => {
    isTouched.value = false;
  }, 300);
};

const loadProfileData = async () => {
  console.log('Current user:', currentUser.value);
  console.log('User ID:', userId.value);

  if (userId.value === currentUser.value?.id?.toString()) {
    profileData.firstName = currentUser.value.first_name || 'Unknown';
    profileData.username = currentUser.value.username || '';
    avatarSrc.value = currentUser.value.photo_url || (currentUser.value.username ? `https://t.me/i/userpic/160/${currentUser.value.username}.jpg` : 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp');
    console.log('Using current user data:', profileData);
  } else {
    try {
      const response = await fetch(`https://impotently-dutiful-hare.cloudpub.ru/api/user/${userId.value}`, {
        headers: {
          'X-Telegram-Data': Telegram.WebApp.initData
        }
      });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = await response.json();
      profileData.firstName = data.firstName || 'Unknown';
      profileData.username = data.username || '';
      avatarSrc.value = data.photoUrl || 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp';
      console.log('Loaded from API:', profileData);
    } catch (error) {
      console.error('Ошибка загрузки профиля:', error);
      profileData.firstName = 'Unknown';
      avatarSrc.value = 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp';
    }
  }
  loaded.value = true;
};

const loadReviews = async () => {
  try {
    const response = await fetch(`https://impotently-dutiful-hare.cloudpub.ru/api/reviews?targetUserId=${userId.value}`, {
      headers: {
        'X-Telegram-Data': Telegram.WebApp.initData
      }
    });
    if (!response.ok) {
      if (response.status === 404) {
        console.error('Endpoint /api/reviews не найден на сервере');
        allReviews.value = [];
      } else if (response.status === 401) {
        console.error('Не авторизован: проверьте Telegram WebApp initData');
        allReviews.value = [];
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ошибка! Статус: ${response.status}`);
      }
    } else {
      const data = await response.json();
      if (!Array.isArray(data)) {
        console.error('Ответ от /api/reviews не является массивом:', data);
        allReviews.value = [];
      } else {
        const filteredAndSortedReviews = data
          .filter(review => review.reviewId)
          .sort((a, b) => {
            if (!a.date || !b.date) return 0;
            return new Date(b.date) - new Date(a.date);
          });
        allReviews.value = filteredAndSortedReviews;
      }
    }
  } catch (error) {
    console.error('Ошибка загрузки отзывов:', error);
    allReviews.value = [];
  }
};

const deleteReview = async (reviewId) => {
  if (!reviewId) {
    Telegram.WebApp.showAlert('Ошибка: ID отзыва отсутствует');
    console.error('Попытка удалить отзыв с undefined reviewId');
    return;
  }
  try {
    const response = await fetch(`https://impotently-dutiful-hare.cloudpub.ru/api/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: {
        'X-Telegram-Data': Telegram.WebApp.initData
      }
    });
    if (!response.ok) throw new Error('Ошибка удаления');
    await loadReviews();
    Telegram.WebApp.showAlert('Отзыв удалён!');
  } catch (error) {
    Telegram.WebApp.showAlert(error.message);
  }
};

const deleteReview = async (reviewId) => {
  try {
    const response = await fetch(`https://impotently-dutiful-hare.cloudpub.ru/api/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: {
        'X-Telegram-Data': Telegram.WebApp.initData
      }
    });
    if (!response.ok) throw new Error('Ошибка удаления');
    await loadReviews();
    Telegram.WebApp.showAlert('Отзыв удалён!');
  } catch (error) {
    Telegram.WebApp.showAlert(error.message);
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
      body: JSON.stringify({ text: reviewText.value, targetUserId: userId.value })
    });
    if (!response.ok) throw new Error('Ошибка создания платежа');
    const { invoiceLink } = await response.json();
    Telegram.WebApp.openInvoice(invoiceLink, async (status) => {
      if (status === 'cancelled') {
        reviewText.value = '';
        Telegram.WebApp.showAlert('The payment is canceled. The review is not saved.');
      }
      if (status === 'paid') {
        await loadReviews();
        reviewText.value = '';
        Telegram.WebApp.showAlert('The review is successfully sent!');
      }
      if (status === 'failed') {
        reviewText.value = '';
        Telegram.WebApp.showAlert('Payment error. Try it again.');
      }
    });
  } catch (error) {
    Telegram.WebApp.showAlert(error.message);
  }
};

const checkAdminStatus = async () => {
  try {
    const response = await fetch('https://impotently-dutiful-hare.cloudpub.ru/api/isAdmin', {
      headers: {
        'X-Telegram-Data': Telegram.WebApp.initData
      }
    });
    const data = await response.json();
    isAdmin.value = data.isAdmin;
  } catch (error) {
    console.error('Error checking admin status:', error);
    isAdmin.value = false;
  }
};

onMounted(async () => {
  console.log('Telegram initData:', Telegram.WebApp.initData);
  currentUser.value = Telegram.WebApp.initDataUnsafe?.user;
  userId.value = route.params.userId || currentUser.value?.id?.toString();
  if (!userId.value) {
    router.push('/');
    return;
  }
  if (Telegram.WebApp.setHeaderColor) {
    Telegram.WebApp.setHeaderColor('#97f492');
  }
  await checkAdminStatus();
  await loadProfileData();
  await loadReviews();
});
</script>

<style scoped>
.profile-container {
  background: linear-gradient(-45deg, #101622, #182038);
  min-height: 100vh;
  padding: 20px 10px;
  overflow: hidden;
}

.back-btn {
  text-decoration: none;
  display: inline-block;
  position: relative;
  z-index: 1000;
}

.back-button-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  border: 1px solid rgba(151, 244, 146, 0.3);
  transition: all 0.3s ease;
  cursor: pointer;
  animation: slideIn 0.5s ease-out;
}

.back-icon {
  width: 20px;
  height: 20px;
  filter: invert(1) brightness(1.5);
  transition: transform 0.3s ease;
}

.back-text {
  color: #97f492;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.3s ease;
  opacity: 1;
}

@media (min-width: 768px) {
  .profile-container {
    padding: 30px 20px;
  }

  .back-button-wrapper {
    padding: 8px 16px;
    gap: 8px;
    border-radius: 25px;
  }

  .back-icon {
    width: 24px;
    height: 24px;
  }

  .back-text {
    font-size: 14px;
    opacity: 0;
    width: 0;
  }

  .back-btn:hover .back-button-wrapper {
    background: rgba(151, 244, 146, 0.15);
    transform: translateX(-5px);
    box-shadow: 0 0 15px rgba(151, 244, 146, 0.2);
  }

  .back-btn:hover .back-icon {
    transform: rotate(-45deg);
  }

  .back-btn:hover .back-text {
    opacity: 1;
    width: auto;
  }
}

@media (max-width: 767px) {
  .back-button-wrapper:active,
  .back-button-wrapper.touched {
    background: rgba(151, 244, 146, 0.2);
    transform: scale(0.95);
    box-shadow: 0 0 10px rgba(151, 244, 146, 0.3);
  }

  .back-button-wrapper:active .back-icon,
  .back-button-wrapper.touched .back-icon {
    transform: rotate(-45deg);
  }
}

@keyframes slideIn {
  from {
    transform: translateX(-20px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
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
  opacity: 1;
  transform: translateY(20px);
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  animation: border-rotate 3s infinite linear;
  z-index: 1000;
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
  background: #272e38;
  border: 1px solid transparent;
  border-radius: 12px;
  color: white;
  resize: none;
  overflow: hidden;
  line-height: 1.0;
  font-family: 'Roboto', sans-serif;
  font-size: 18px;
  font-weight: 400;
  transition: all 0.3s;
}

.review-input:focus {
  outline: none;
  border-color: #97f492;
  box-shadow: 0 0 0 2px rgba(151, 244, 146, 0.3);
}

.review-input::placeholder {
  color: #6b7280;
  line-height: 0.5;
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

.delete-btn {
  background: none;
  border: none;
  color: #ff4444;
  margin-left: 10px;
  cursor: pointer;
  padding: 2px 5px;
  font-size: 1.2em;
}

.delete-btn:hover {
  opacity: 0.8;
  transform: scale(1.1);
  transition: transform 0.2s ease;
}
</style>