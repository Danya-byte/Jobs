<template>
  <div class="container">
    <nav class="nav-bar">
      <h1>My chats</h1>
      <RouterLink to="/" class="home-button">Home</RouterLink>
    </nav>

    <div class="chat-list">
      <p v-if="chats.length === 0" class="no-chats">No chats available.</p>
      <div class="chat-list-wrapper">
        <div v-for="chat in chats" :key="chat.id" class="chat-item-wrapper" :style="{ position: 'relative' }">
          <div v-if="isMobile()" class="swipe-actions" :style="{ right: swipeOffset[chat.id] === -120 ? '0' : '-120px', display: 'flex' }">
            <div class="swipe-icon report-icon" @click.stop="reportChat(chat.id)">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3H21L12 21L3 3Z" fill="currentColor" />
                <path d="M12 7V13" stroke="#000" stroke-width="2" stroke-linecap="round" />
                <circle cx="12" cy="15" r="1" fill="#000" />
              </svg>
            </div>
            <div class="swipe-icon delete-icon" @click.stop="deleteChat(chat.id)">🗑️</div>
          </div>
          <div
            class="chat-item-container"
            :class="{ swiped: swipeOffset[chat.id] === -120 }"
            :style="{
              transform: `translateX(${swipeOffset[chat.id] || 0}px)`,
              transition: swipeOffset[chat.id] ? 'none' : 'transform 0.2s ease'
            }"
          >
            <RouterLink
              :to="`/chat/${chat.id}`"
              class="chat-item"
              @touchstart="isMobile() && startSwipe($event, chat.id)"
              @touchmove="isMobile() && moveSwipe($event, chat.id)"
              @touchend="isMobile() && endSwipe(chat.id)"
            >
              <img :src="chat.photoUrl" class="chat-icon" loading="lazy" @error="handleImageError" />
              <div class="chat-info">
                <p class="nick">{{ chat.nick }}</p>
                <p class="last-message">{{ chat.lastMessage }}</p>
                <p v-if="chat.blocked" class="blocked-status">Заблокирован</p>
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
          <button class="close-btn" @click="closeModal">✖</button>
          <h3>{{ modalTitle }}</h3>
          <p>{{ modalMessage }}</p>
          <div v-if="modalInput" class="modal-input">
            <input v-model="modalInputValue" placeholder="Введите текст" />
          </div>
          <div class="modal-buttons">
            <button
              v-for="btn in modalButtons"
              :key="btn.id"
              :class="['modal-btn', btn.type]"
              @click="handleModalAction(btn.id)"
            >
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

const BASE_URL = 'https://jobs.cloudpub.ru';
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
const activeSwipedChat = ref(null);

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
              nick: job.nick || 'Unknown',
              username: job.username || '',
              photoUrl: job.username ? `https://t.me/i/userpic/160/${job.username}.jpg` : defaultPhoto,
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
      const chatId = `${chat.jobId}_${chat.targetUserId}`;
      try {
        const statusResponse = await axios.get(`${BASE_URL}/api/chat/status/${chatId}`, {
          headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
        });
        chat.blocked = statusResponse.data.blocked;
      } catch (error) {
        chat.blocked = false;
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
        blocked: chat.blocked,
      };
    });
  } catch (error) {
    console.error('Ошибка загрузки чатов:', error);
  }
};

const handleImageError = (event) => {
  event.target.src = defaultPhoto;
};

const showCustomPopup = (options, callback) => {
  closeModal();
  modalTitle.value = options.title;
  modalMessage.value = options.message;
  modalButtons.value = options.buttons;
  modalInput.value = options.input || false;
  modalInputValue.value = '';
  modalCallback.value = callback;
  showModal.value = true;
};

const showCustomConfirm = (message, callback) => {
  closeModal();
  modalTitle.value = 'Подтверждение';
  modalMessage.value = message;
  modalButtons.value = [
    { id: 'confirm', type: 'default', text: 'Да' },
    { id: 'cancel', type: 'cancel', text: 'Нет' }
  ];
  modalCallback.value = callback;
  modalInput.value = false;
  showModal.value = true;
};

const showNotification = (message) => {
  if (window.Telegram && window.Telegram.WebApp) {
    Telegram.WebApp.showAlert(message);
  } else {
    alert(message);
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
      { id: 'delete', type: 'destructive', text: 'Удалить чат' }
    ],
  }, (buttonId) => {
    if (buttonId === 'report') reportChat(chatId);
    else if (buttonId === 'delete') deleteChat(chatId);
  });
};

const startSwipe = (event, chatId) => {
  if (!isMobile()) return;
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
  const deltaY = event.touches[0].clientY - touch.startY;
  if (Math.abs(deltaX) > 10) {
    event.preventDefault();
    if (deltaX < 0) {
      if (activeSwipedChat.value && activeSwipedChat.value !== chatId) {
        swipeOffset.value[activeSwipedChat.value] = 0;
        activeSwipedChat.value = null;
      }
      swipeOffset.value[chatId] = Math.max(deltaX, -120);
    } else if (swipeOffset.value[chatId] === -120) {
      swipeOffset.value[chatId] = Math.min(deltaX, 0);
    }
  }
};

const endSwipe = (chatId) => {
  const delta = swipeOffset.value[chatId];
  if (delta < -60) {
    swipeOffset.value[chatId] = -120;
    activeSwipedChat.value = chatId;
  } else if (delta > -60) {
    swipeOffset.value[chatId] = 0;
    if (activeSwipedChat.value === chatId) {
      activeSwipedChat.value = null;
    }
  }
  delete event.target.touchData;
};

const reportChat = async (chatId) => {
  setTimeout(() => {
    showCustomPopup({
      title: 'Пожаловаться',
      message: 'Укажите причину жалобы',
      buttons: [
        { id: 'submit', type: 'default', text: 'Отправить' }
      ],
      input: true,
    }, async (buttonId, inputText) => {
      if (buttonId === 'submit' && inputText) {
        await submitReport(chatId, inputText);
      }
    });
  }, 300);
  swipeOffset.value[chatId] = 0;
  if (activeSwipedChat.value === chatId) activeSwipedChat.value = null;
};

const submitReport = async (chatId) => {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/report`,
      { chatId, reason: modalInputValue.value },
      { headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData } }
    );
    if (response.data.success) {
      showNotification('Жалоба отправлена');
      const statusResponse = await axios.get(`${BASE_URL}/api/chat/status/${chatId}`, {
        headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
      });
      chats.value = chats.value.map(chat =>
        chat.id === chatId ? { ...chat, blocked: statusResponse.data.blocked } : chat
      );
    } else {
      showNotification('Ошибка при отправке жалобы');
    }
  } catch (error) {
    showNotification('Ошибка при отправке жалобы');
  }
};

const deleteChat = async (chatId) => {
  setTimeout(() => {
    showCustomConfirm(
      'Вы точно хотите удалить данный чат? История чата удаляется тоже',
      async (buttonId) => {
        if (buttonId === 'confirm') {
          try {
            const response = await axios.delete(`${BASE_URL}/api/chat/${chatId}`, {
              headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
            });
            if (response.data.success) {
              chats.value = chats.value.filter((chat) => chat.id !== chatId);
            } else {
              showNotification('Ошибка при удалении чата');
            }
          } catch (error) {
            showNotification('Ошибка при удалении чата');
          }
        }
      }
    );
  }, 300);
  swipeOffset.value[chatId] = 0;
  if (activeSwipedChat.value === chatId) activeSwipedChat.value = null;
};

onMounted(() => {
  fetchChats();
  if (Telegram.WebApp.setHeaderColor) Telegram.WebApp.setHeaderColor('#97f492');
});
</script>

<style scoped>
.blocked-status { color: #ff4444; font-size: 12px; margin: 5px 0 0; }
body { margin: 0; font-family: 'Geologica', sans-serif; background: linear-gradient(45deg, #0a0f1a, #141b2d); color: white; min-height: 100vh; overflow-x: hidden; overflow-y: hidden; }
html { overflow-x: hidden; overflow-y: hidden; height: 100%; }
* { box-sizing: border-box; transition: none; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@keyframes gradient-shift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
.dynamic-bg { animation: gradient-shift 15s ease infinite; background-size: 200% 200%; }
button, a, input, textarea, select { -webkit-tap-highlight-color: transparent; }
.container { background: linear-gradient(45deg, #101622, #1a2233); height: 100vh; padding: 20px; display: flex; flex-direction: column; overflow: hidden; position: relative; width: 100%; max-width: 100%; }
.nav-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-shrink: 0; width: 100%; }
h1 { color: #97f492; font-size: 28px; margin: 0; font-family: 'Inter', system-ui; font-weight: 600; letter-spacing: -0.03em; text-shadow: 0 2px 4px rgba(151, 244, 146, 0.2); }
.home-button { background: linear-gradient(135deg, #97f492 0%, #6de06a 100%); padding: 8px 20px; border-radius: 30px; color: #000; font-weight: 400; text-decoration: none; box-shadow: 0 4px 15px rgba(151, 244, 146, 0.3); transition: transform 0.3s, background 0.3s; }
.home-button:hover { transform: translateY(-2px); background: #6de06a; }
.chat-list { flex: 1; display: flex; flex-direction: column; overflow: hidden; width: 100%; }
.chat-list-wrapper { flex: 1; overflow-y: auto; overflow-x: hidden; scrollbar-width: none; -ms-overflow-style: none; position: relative; width: 100%; }
.chat-list-wrapper::-webkit-scrollbar { width: 0; }
.chat-item-wrapper { position: relative; overflow: visible; margin-bottom: 10px; width: 100%; }
.chat-item-container { position: relative; z-index: 2; width: 100%; }
.chat-item { display: flex; align-items: center; gap: 15px; background: #181e29; border-radius: 20px; padding: 15px; text-decoration: none; border: 1px solid #2d3540; transition: transform 0.3s ease; width: 100%; box-sizing: border-box; }
.chat-item:hover { background: #1f2633; }
.chat-icon { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; aspect-ratio: 1/1; }
.chat-info { flex: 1; overflow: hidden; }
.nick { color: #97f492; font-size: 16px; margin: 0; font-family: 'Inter', system-ui; font-weight: 600; letter-spacing: -0.03em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.last-message { color: #b0b5bf; font-size: 14px; margin: 0; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.no-chats { color: #97f492; font-size: 16px; text-align: center; padding: 20px; }
.options-btn { background: none; border: none; color: #fff; font-size: 20px; cursor: pointer; padding: 0.5rem; transition: background 0.2s; }
.options-btn:hover { background: rgba(151, 244, 146, 0.2); }
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; overflow: hidden; }
.modal-content { background: #1a2233; padding: 20px; border-radius: 15px; width: 90%; max-width: 400px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3); position: relative; }
.close-btn { position: absolute; top: 10px; right: 10px; background: none; border: none; color: #fff; font-size: 20px; cursor: pointer; padding: 0; }
.close-btn:hover { color: #97f492; }
.modal-content h3 { color: #97f492; margin: 0 0 15px; }
.modal-content p { color: #fff; margin: 0 0 20px; }
.modal-input { margin-bottom: 20px; }
.modal-input input { width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid #97f492; background: #272e38; color: #fff; }
.modal-buttons { display: flex; justify-content: space-around; gap: 10px; }
.modal-btn { padding: 8px 16px; border-radius: 20px; border: none; cursor: pointer; transition: transform 0.2s; flex: 1; text-align: center; }
.modal-btn:hover { transform: translateY(-2px); }
.modal-btn.default { background: #97f492; color: #000; }
.modal-btn.destructive { background: #ff4444; color: #fff; }
.modal-btn.cancel { background: #2d3540; color: #fff; }
.modal-enter-active, .modal-leave-active { transition: opacity 0.3s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.swipe-actions { position: absolute; top: 0; right: -120px; bottom: 0; display: flex; align-items: center; justify-content: space-around; width: 120px; z-index: 10; background: linear-gradient(90deg, #181e29 0%, #2d3540 100%); border-radius: 0 20px 20px 0; transition: right 0.2s ease; }
.swipe-icon { width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; user-select: none; pointer-events: auto; cursor: pointer; color: #fff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5), inset 0 -2px 4px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.2); transition: transform 0.2s ease, box-shadow 0.2s ease; }
.swipe-icon:hover { transform: scale(1.1); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.6), inset 0 -2px 4px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.3); }
.report-icon { background: linear-gradient(135deg, #ffeb3b 0%, #fbc02d 100%); }
.report-icon svg { width: 24px; height: 24px; transform: scaleY(-1); }
.delete-icon { background: linear-gradient(135deg, #ff6f61 0%, #d32f2f 100%); }
.chat-item-container.swiped { background: #181e29; }
.chat-item-container.swiped .swipe-actions { right: 0 !important; }
@media (max-width: 768px) { .chat-icon { width: 48px; height: 48px; } .home-button { padding: 8px 16px; } }
@media (min-height: 500px) and (orientation: landscape) { .chat-header { padding: 0.5rem; } .user-avatar { width: 32px; height: 32px; } }
</style>