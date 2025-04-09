<template>
  <div class="chat-container">
    <div class="chat-header">
      <button class="back-button" @click="goBack">←</button>
      <div class="chat-title">
        <img :src="freelancerPhotoUrl" class="chat-avatar" @error="handleImageError" />
        <div>
          <span>{{ freelancerNick || 'Пользователь' }}</span>
          <span class="job-title">{{ jobDetails.position || 'Название вакансии' }}</span>
        </div>
      </div>
      <div class="chat-actions">
        <button class="report-button" @click="reportChat">Пожаловаться</button>
        <button class="delete-button" @click="deleteChat">Удалить</button>
      </div>
    </div>
    <div v-if="isChatDeleted" class="chat-deleted-overlay">
      <p class="overlay-text">Чат удалён</p>
    </div>
    <div v-else-if="isBlocked" class="chat-overlay">
      <p class="overlay-text">Чат остановлен до вмешательства модерации</p>
    </div>
    <div v-else-if="messages.length === 0" class="chat-overlay">
      <p class="overlay-text">Сообщений пока нет</p>
    </div>
    <div v-else class="messages-container" ref="messagesContainer">
      <div v-for="message in messages" :key="message.id" :class="['message', message.isSender ? 'sent' : 'received']">
        <span class="message-text">{{ message.text }}</span>
        <span class="message-time">{{ formatTime(message.timestamp) }}</span>
      </div>
    </div>
    <div v-if="!isChatDeleted && !isBlocked" class="input-container">
      <textarea ref="messageInput" v-model="newMessage" @keydown.enter.prevent="sendMessage" placeholder="Введите сообщение..." rows="1"></textarea>
      <button class="send-button" @click="sendMessage">Отправить</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://jobs.cloudpub.ru';
const WS_URL = 'wss://jobs.cloudpub.ru';

const route = useRoute();
const router = useRouter();
const chatUuid = ref(route.params.chatUuid);
const jobId = ref(route.query.jobId);
const targetUserId = ref(route.query.targetUserId);
const currentUserId = ref('');
const messages = ref([]);
const newMessage = ref('');
const messagesContainer = ref(null);
const messageInput = ref(null);
const freelancerNick = ref('');
const freelancerPhotoUrl = ref('https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp');
const jobDetails = ref({});
const isChatDeleted = ref(false);
const isBlocked = ref(false);
const ws = ref(null);

const validateParams = () => {
  if (!chatUuid.value) {
    Telegram.WebApp.showAlert('Ошибка: отсутствует идентификатор чата');
    router.push('/chats');
    return false;
  }
  return true;
};

const fetchFreelancerDetails = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/user/${targetUserId.value}/avatar`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    freelancerNick.value = response.data.firstName;
    freelancerPhotoUrl.value = response.data.photoUrl;

    const jobsResponse = await axios.get(`${BASE_URL}/api/jobs`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    const job = jobsResponse.data.find(j => j.id === jobId.value);
    if (job) {
      jobDetails.value = job;
    }
  } catch (error) {
    console.error('Ошибка загрузки данных фрилансера:', error);
  }
};

const fetchMessages = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/messages/${chatUuid.value}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    messages.value = response.data;
    nextTick(() => scrollToBottom());
  } catch (error) {
    if (error.response?.status === 404) {
      messages.value = [];
    } else {
      console.error('Ошибка загрузки сообщений:', error);
    }
  }
};

const sendMessage = async () => {
  if (!newMessage.value.trim()) return;
  try {
    const response = await axios.post(`${BASE_URL}/api/chat/${targetUserId.value}`, {
      text: newMessage.value,
      jobId: jobId.value
    }, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    if (response.data.invoiceLink) {
      window.open(response.data.invoiceLink, '_blank');
    } else {
      newMessage.value = '';
      fetchMessages();
    }
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    Telegram.WebApp.showAlert('Ошибка при отправке сообщения');
  }
};

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const goBack = () => {
  router.push('/chats');
};

const deleteChat = async () => {
  Telegram.WebApp.showConfirm('Вы уверены, что хотите удалить чат?', async (confirmed) => {
    if (confirmed) {
      try {
        await axios.delete(`${BASE_URL}/api/chat/${chatUuid.value}`, {
          headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
        });
        isChatDeleted.value = true;
        setTimeout(() => router.push('/chats'), 1000);
      } catch (error) {
        console.error('Ошибка при удалении чата:', error);
        Telegram.WebApp.showAlert('Ошибка при удалении чата');
      }
    }
  });
};

const reportChat = () => {
  Telegram.WebApp.showPopup(
    {
      title: 'Пожаловаться',
      message: 'Укажите причину жалобы',
      buttons: [{ id: 'submit', type: 'default', text: 'Отправить' }],
    },
    async (buttonId) => {
      if (buttonId === 'submit') {
        const reason = prompt('Укажите причину жалобы');
        if (reason) {
          try {
            await axios.post(`${BASE_URL}/api/report`, {
              chatUuid: chatUuid.value,
              reason
            }, {
              headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
            });
            isBlocked.value = true;
            Telegram.WebApp.showAlert('Жалоба отправлена');
          } catch (error) {
            console.error('Ошибка при отправке жалобы:', error);
            Telegram.WebApp.showAlert('Ошибка при отправке жалобы');
          }
        }
      }
    }
  );
};

const checkChatStatus = async () => {
  if (isChatDeleted.value) return;
  try {
    const response = await axios.get(`${BASE_URL}/api/chat/status/${chatUuid.value}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    isBlocked.value = response.data.blocked;
  } catch (error) {
    if (error.response?.status === 400 || error.response?.status === 404) {
      isChatDeleted.value = true;
    }
    console.error('Ошибка проверки статуса чата:', error);
  }
};

const handleImageError = (event) => {
  event.target.src = 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp';
};

const setupWebSocket = () => {
  ws.value = new WebSocket(WS_URL, [], {
    headers: { 'user-id': currentUserId.value }
  });
  ws.value.onopen = () => console.log('WebSocket connected');
  ws.value.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'newMessage' && data.chatUuid === chatUuid.value) {
      fetchMessages();
    }
  };
  ws.value.onerror = (error) => console.error('WebSocket error:', error);
  ws.value.onclose = () => console.log('WebSocket disconnected');
};

onMounted(() => {
  if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    currentUserId.value = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
  } else {
    Telegram.WebApp.showAlert('Откройте приложение через Telegram.');
    router.push('/chats');
    return;
  }
  if (!validateParams()) return;

  Telegram.WebApp.setHeaderColor('#97f492');
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
  fetchFreelancerDetails();
  fetchMessages();
  checkChatStatus();
  setupWebSocket();
});

onUnmounted(() => {
  postEvent('web_app_setup_back_button', { is_visible: true });

  if (ws.value) {
    ws.value.close();
  }
});
</script>


<style scoped>
.chat-container { display: flex; flex-direction: column; height: 100vh; background-color: #f0f0f0; font-family: Arial, sans-serif; }
.chat-header { display: flex; align-items: center; padding: 10px; background-color: #97f492; color: #000; position: fixed; top: 0; left: 0; right: 0; z-index: 100; }
.back-button { background: none; border: none; font-size: 24px; cursor: pointer; color: #000; }
.chat-title { flex-grow: 1; display: flex; align-items: center; padding-left: 10px; }
.chat-avatar { width: 40px; height: 40px; border-radius: 50%; margin-right: 10px; object-fit: cover; }
.chat-title div { display: flex; flex-direction: column; }
.job-title { font-size: 14px; color: #555; }
.chat-actions { display: flex; gap: 10px; }
.report-button, .delete-button { background-color: #ff4444; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; }
.messages-container { flex-grow: 1; padding: 70px 10px 60px; overflow-y: auto; }
.message { display: flex; flex-direction: column; margin: 5px 0; padding: 10px; border-radius: 10px; max-width: 70%; }
.sent { align-self: flex-end; background-color: #97f492; color: #000; }
.received { align-self: flex-start; background-color: #fff; color: #000; }
.message-text { word-wrap: break-word; }
.message-time { font-size: 12px; color: #666; align-self: flex-end; }
.input-container { display: flex; padding: 10px; background-color: #fff; position: fixed; bottom: 0; left: 0; right: 0; border-top: 1px solid #ddd; }
textarea { flex-grow: 1; padding: 10px; border: 1px solid #ddd; border-radius: 5px; resize: none; overflow-y: auto; max-height: 100px; }
.send-button { margin-left: 10px; padding: 10px 20px; background-color: #97f492; color: #000; border: none; border-radius: 5px; cursor: pointer; }
.chat-overlay, .chat-deleted-overlay { position: fixed; top: 50px; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.7); display: flex; justify-content: center; align-items: center; z-index: 10; }
.overlay-text { color: white; font-size: 18px; text-align: center; padding: 20px; background-color: #333; border-radius: 10px; }
</style>