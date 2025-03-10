<template>
  <div class="container">
    <nav class="nav-bar">
      <h1>My chats</h1>
      <RouterLink to="/" class="home-button">Home</RouterLink>
    </nav>

    <div class="chat-list">
      <p v-if="chats.length === 0" class="no-chats">No chats available.</p>
      <div class="chat-list-wrapper">
        <div v-for="chat in chats" :key="chat.id" class="chat-item-wrapper">
          <div class="swipe-actions">
            <div class="swipe-icon report-icon" @click.stop="reportChat(chat.id)">⚠️</div>
            <div class="swipe-icon delete-icon" @click.stop="deleteChat(chat.id)">🗑️</div>
          </div>
          <div
            class="chat-item-container"
            :style="{
              transform: `translateX(${swipeOffset[chat.id] || 0}px)`,
              transition: swipeOffset[chat.id] ? 'none' : 'transform 0.2s ease'
            }"
          >
            <RouterLink
              :to="{ path: `/chat/${chat.targetUserId}`, query: { username: chat.username, jobId: chat.jobId } }"
              class="chat-item"
              @touchstart="isMobile() && startSwipe($event, chat.id)"
              @touchmove="isMobile() && moveSwipe($event, chat.id)"
              @touchend="isMobile() && endSwipe(chat.id)"
            >
              <img :src="chat.photoUrl" class="chat-icon" loading="lazy" @error="handleImageError" />
              <div class="chat-info">
                <p class="nick">{{ chat.nick }}</p>
                <p class="last-message">{{ chat.lastMessage }}</p>
              </div>
              <button v-if="!isMobile()" class="options-btn" @click.stop.prevent="openOptions(chat.id)">⋮</button>
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
    <transition name="modal">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal-content">
          <h3>{{ modalTitle }}</h3>
          <p>{{ modalMessage }}</p>
          <div v-if="modalInput" class="modal-input">
            <input v-model="modalInputValue" placeholder="Введите текст" />
          </div>
          <div class="modal-buttons">
            <button v-for="btn in modalButtons" :key="btn.id" :class="['modal-btn', btn.type]" @click="handleModalAction(btn.id)">
              {{ btn.text }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const BASE_URL = 'https://impotently-dutiful-hare.cloudpub.ru';
const chats = ref([]);
const defaultPhoto = 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp';
const currentUserId = ref(window.Telegram.WebApp.initDataUnsafe.user.id.toString());
const swipeOffset = ref({});
const showModal = ref(false);
const modalTitle = ref('');
const modalMessage = ref('');
const modalButtons = ref([]);
const modalCallback = ref(null);
const modalInput = ref(false);
const modalInputValue = ref('');

const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const fetchChats = async () => {
  try {
    const messagesResponse = await axios.get(`${BASE_URL}/api/chats`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
    });
    const messages = messagesResponse.data.filter(msg =>
      msg.authorUserId.toString() === currentUserId.value ||
      msg.targetUserId.toString() === currentUserId.value
    );

    const jobsResponse = await axios.get(`${BASE_URL}/api/jobs`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
    });
    const jobs = jobsResponse.data;

    const chatMap = new Map();
    messages.forEach((msg) => {
      if (msg.jobId) {
        const otherUserId = msg.authorUserId.toString() === currentUserId.value
          ? msg.targetUserId.toString()
          : msg.authorUserId.toString();
        const key = `${msg.jobId}_${otherUserId}`;

        if (!chatMap.has(key)) {
          const job = jobs.find((j) => j.id === msg.jobId);
          if (job) {
            chatMap.set(key, {
              jobId: msg.jobId,
              targetUserId: otherUserId,
              messages: [],
              nick: '',
              username: job.username || '',
              photoUrl: '',
              lastMessageTime: new Date(0),
            });
          }
        }
        if (chatMap.has(key)) {
          chatMap.get(key).messages.push(msg);
          const msgTime = new Date(msg.timestamp);
          if (msgTime > chatMap.get(key).lastMessageTime) {
            chatMap.get(key).lastMessageTime = msgTime;
          }
        }
      }
    });

    const sortedChats = Array.from(chatMap.values()).sort((a, b) => b.lastMessageTime - a.lastMessageTime);

    for (const chat of sortedChats) {
      try {
        const userResponse = await axios.get(`${BASE_URL}/api/profile/${chat.targetUserId}`, {
          headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
        });
        chat.nick = userResponse.data.nick || 'Unknown';
        chat.photoUrl = userResponse.data.photoUrl || defaultPhoto;
      } catch (error) {
        chat.nick = 'Unknown';
        chat.photoUrl = defaultPhoto;
      }
    }

    chats.value = sortedChats.map((chat) => {
      const lastMessage = chat.messages[chat.messages.length - 1];
      return {
        id: `${chat.jobId}_${chat.targetUserId}`,
        targetUserId: chat.targetUserId,
        jobId: chat.jobId,
        nick: chat.nick,
        username: chat.username,
        photoUrl: chat.photoUrl,
        lastMessage: lastMessage.text.slice(0, 30) + (lastMessage.text.length > 30 ? '...' : ''),
        lastMessageTime: chat.lastMessageTime,
      };
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
  }
};

const handleImageError = (event) => {
  event.target.src = defaultPhoto;
};

const showCustomPopup = (options, callback) => {
  if (isMobile()) {
    Telegram.WebApp.showPopup(options, callback);
  } else {
    modalTitle.value = options.title;
    modalMessage.value = options.message;
    modalButtons.value = options.buttons;
    modalInput.value = options.input || false;
    modalInputValue.value = '';
    modalCallback.value = callback;
    showModal.value = true;
  }
};

const showCustomConfirm = (message, callback) => {
  if (isMobile()) {
    Telegram.WebApp.showConfirm(message, callback);
  } else {
    modalTitle.value = 'Подтверждение';
    modalMessage.value = message;
    modalButtons.value = [
      { id: 'confirm', type: 'default', text: 'Да' },
      { id: 'cancel', type: 'cancel', text: 'Нет' }
    ];
    modalCallback.value = callback;
    modalInput.value = false;
    showModal.value = true;
  }
};

const handleModalAction = (buttonId) => {
  if (modalCallback.value && buttonId) {
    modalCallback.value(buttonId, modalInput.value ? modalInputValue.value : null);
  }
  closeModal();
};

const closeModal = () => {
  showModal.value = false;
  modalCallback.value = null;
  modalInputValue.value = '';
};

const openOptions = (chatId) => {
  showCustomPopup({
    title: 'Действия с чатом',
    message: 'Выберите действие',
    buttons: [
      { id: 'report', type: 'default', text: 'Пожаловаться' },
      { id: 'delete', type: 'destructive', text: 'Удалить чат' },
      { id: 'cancel', type: 'cancel', text: 'Отмена' },
    ],
  }, (buttonId) => {
    if (buttonId === 'report') reportChat(chatId);
    else if (buttonId === 'delete') deleteChat(chatId);
  });
};

const startSwipe = (event, chatId) => {
  if (!isMobile()) return;
  event.preventDefault();
  const touch = event.touches[0];
  touch.startX = touch.clientX;
  touch.startY = touch.clientY;
  touch.chatId = chatId;
  event.target.touchData = touch;
};

const moveSwipe = (event, chatId) => {
  const touch = event.target.touchData;
  if (!touch || touch.chatId !== chatId) return;

  const deltaX = event.touches[0].clientX - touch.startX;
  if (Math.abs(deltaX) > Math.abs(event.touches[0].clientY - touch.startY)) {
    event.preventDefault();
    if (deltaX < 0 && deltaX > -120) {
      swipeOffset.value[chatId] = deltaX;
    }
  }
};

const endSwipe = (chatId) => {
  const delta = swipeOffset.value[chatId];
  if (delta < -60) {
    swipeOffset.value[chatId] = -120;
    setTimeout(() => swipeOffset.value[chatId] = 0, 1500);
  } else {
    swipeOffset.value[chatId] = 0;
  }
  delete event.target.touchData;
};

const reportChat = async (chatId) => {
  showCustomPopup({
    title: 'Пожаловаться',
    message: 'Выберите причину жалобы',
    buttons: [
      { id: 'spam', type: 'default', text: 'Спам' },
      { id: 'insult', type: 'default', text: 'Оскорбления' },
      { id: 'other', type: 'default', text: 'Другое' },
      { id: 'cancel', type: 'cancel', text: 'Отмена' },
    ],
  }, async (buttonId) => {
    if (buttonId === 'cancel') return;

    let reportText = '';
    if (buttonId === 'spam') reportText = 'Спам';
    else if (buttonId === 'insult') reportText = 'Оскорбления';
    else if (buttonId === 'other') {
      showCustomPopup({
        title: 'Укажите причину',
        message: 'Введите текст жалобы',
        buttons: [
          { id: 'submit', type: 'default', text: 'Отправить' },
          { id: 'cancel', type: 'cancel', text: 'Отмена' },
        ],
        input: true,
      }, async (submitButtonId, inputText) => {
        if (submitButtonId === 'submit' && inputText) {
          await submitReport(chatId, inputText);
        }
      });
      return;
    }
    if (reportText) await submitReport(chatId, reportText);
  });
  swipeOffset.value[chatId] = 0;
};

const submitReport = async (chatId, reportText) => {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/report`,
      { chatId, reason: reportText },
      { headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData } }
    );
    if (response.data.success) {
      Telegram.WebApp.showAlert('Жалоба отправлена');
      chats.value = chats.value.map(chat =>
        chat.id === chatId ? { ...chat, blocked: true } : chat
      );
    } else {
      Telegram.WebApp.showAlert('Ошибка при отправке жалобы');
    }
  } catch (error) {
    console.error('Error reporting chat:', error);
    Telegram.WebApp.showAlert('Ошибка при отправке жалобы');
  }
};

const deleteChat = async (chatId) => {
  showCustomConfirm(
    'Вы точно хотите удалить данный чат? История чата не удаляется тоже',
    async (buttonId) => {
      if (buttonId === 'confirm') {
        try {
          const response = await axios.delete(`${BASE_URL}/api/chat/${chatId}`, {
            headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
          });
          if (response.data.success) {
            chats.value = chats.value.filter((chat) => chat.id !== chatId);
          } else {
            Telegram.WebApp.showAlert('Ошибка при удалении чата');
          }
        } catch (error) {
          console.error('Error deleting chat:', error);
          Telegram.WebApp.showAlert('Ошибка при удалении чата');
        }
      }
    }
  );
  swipeOffset.value[chatId] = 0;
};

onMounted(() => {
  fetchChats();
  if (Telegram.WebApp.setHeaderColor) Telegram.WebApp.setHeaderColor('#97f492');
});
</script>

<style scoped>
body {
    margin: 0;
    font-family: 'Geologica', sans-serif;
    background: linear-gradient(45deg, #0a0f1a, #141b2d);
    color: white;
    min-height: 100vh;
    overflow-x: hidden;
    overflow-y: auto;
}

* {
    box-sizing: border-box;
    transition: none;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

@keyframes gradient-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
}

.dynamic-bg {
    animation: gradient-shift 15s ease infinite;
    background-size: 200% 200%;
}

button, a, input, textarea, select {
    -webkit-tap-highlight-color: transparent;
}

html {
    overflow-x: hidden;
    height: auto;
}

.container {
    background: linear-gradient(45deg, #101622, #1a2233);
    height: 100vh;
    padding: 20px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
}

.nav-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-shrink: 0;
}

h1 {
    color: #97f492;
    font-size: 28px;
    margin: 0;
    font-family: 'Inter', system-ui;
    font-weight: 600;
    letter-spacing: -0.03em;
    text-shadow: 0 2px 4px rgba(151, 244, 146, 0.2);
}

.home-button {
    background: linear-gradient(135deg, #97f492 0%, #6de06a 100%);
    padding: 8px 20px;
    border-radius: 30px;
    color: #000;
    font-weight: 400;
    text-decoration: none;
    box-shadow: 0 4px 15px rgba(151, 244, 146, 0.3);
    transition: transform 0.3s, background 0.3s;
}

.home-button:hover {
    transform: translateY(-2px);
    background: #6de06a;
}

.chat-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.chat-list-wrapper {
    flex: 1;
    overflow-y: scroll;
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.chat-list-wrapper::-webkit-scrollbar {
    display: none;
}

.chat-item-wrapper {
    position: relative;
    overflow: visible;
    margin-bottom: 10px;
}

.chat-item-container {
    position: relative;
    z-index: 2;
}

.chat-item {
    display: flex;
    align-items: center;
    gap: 15px;
    background: #181e29;
    border-radius: 20px;
    padding: 15px;
    text-decoration: none;
    border: 1px solid #2d3540;
    transition: transform 0.3s ease;
    width: 100%;
}

.chat-item:hover {
    background: #1f2633;
}

.chat-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    object-fit: cover;
    aspect-ratio: 1/1;
}

.chat-info {
    flex: 1;
}

.nick {
    color: #97f492;
    font-size: 16px;
    margin: 0;
    font-family: 'Inter', system-ui;
    font-weight: 600;
    letter-spacing: -0.03em;
}

.last-message {
    color: #b0b5bf;
    font-size: 14px;
    margin: 0;
    line-height: 1.4;
}

.no-chats {
    color: #97f492;
    font-size: 16px;
    text-align: center;
    padding: 20px;
}

.options-btn {
    background: none;
    border: none;
    color: #fff;
    font-size: 20px;
    cursor: pointer;
    padding: 0.5rem;
    transition: background 0.2s;
}

.options-btn:hover {
    background: rgba(151, 244, 146, 0.2);
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal-content {
    background: #1a2233;
    padding: 20px;
    border-radius: 15px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

.modal-content h3 {
    color: #97f492;
    margin: 0 0 15px;
}

.modal-content p {
    color: #fff;
    margin: 0 0 20px;
}

.modal-input {
    margin-bottom: 20px;
}

.modal-input input {
    width: 100%;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid #97f492;
    background: #272e38;
    color: #fff;
}

.modal-buttons {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}

.modal-btn {
    padding: 8px 16px;
    border-radius: 20px;
    border: none;
    cursor: pointer;
    transition: transform 0.2s;
}

.modal-btn:hover {
    transform: translateY(-2px);
}

.modal-btn.default {
    background: #97f492;
    color: #000;
}

.modal-btn.destructive {
    background: #ff4444;
    color: #fff;
}

.modal-btn.cancel {
    background: #2d3540;
    color: #fff;
}

.modal-enter-active,
.modal-leave-active {
    transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}

.swipe-actions {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding-right: 15px;
    width: 120px;
    z-index: 1;
}

.swipe-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    user-select: none;
    pointer-events: auto;
    cursor: pointer;
}

.report-icon {
    background: #ffd700;
    color: #000;
}

.delete-icon {
    background: #ff4444;
    color: white;
}

@media (max-width: 768px) {
    .chat-icon {
        width: 48px;
        height: 48px;
    }
    .home-button {
        padding: 8px 16px;
    }
    .swipe-actions {
        display: none;
    }
    .chat-item-container.swiped .swipe-actions {
        display: flex;
    }
}

@media (min-height: 500px) and (orientation: landscape) {
    .chat-header {
        padding: 0.5rem;
    }
    .user-avatar {
        width: 32px;
        height: 32px;
    }
}
</style>