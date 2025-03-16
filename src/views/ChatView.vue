<template>
  <div class="chat-container" @click="hideKeyboard">
    <div class="chat-header">
      <button class="back-btn" @click="$router.push('/chats')">
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div class="user-info">
        <img :src="userPhoto || 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp'" class="user-avatar" loading="lazy">
        <h2>{{ nick || 'Unknown' }}</h2>
      </div>
      <button class="close-btn" @click="$router.push('/')">×</button>
    </div>
    <div class="chat-messages" ref="messagesContainer">
      <div v-for="(message, index) in messages" :key="index"
           :class="['message', message.isSender ? 'sent' : 'received']">
        <p>{{ message.text }}</p>
        <span class="timestamp">{{ formatTimestamp(message.timestamp) }}</span>
      </div>
    </div>
    <div class="chat-input">
      <input v-model="newMessage" placeholder="Type a message..."
             @keyup.enter="sendMessage" class="message-input"
             ref="messageInput">
      <button @click="sendMessage" class="send-btn">
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
        </svg>
      </button>
    </div>
    <div v-if="isBlocked" class="chat-overlay">
      <p class="overlay-text">Чат остановлен до вмешательства модерации и решения конфликта</p>
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
            <button v-for="btn in modalButtons" :key="btn.id"
                    :class="['modal-btn', btn.type]"
                    @click="handleModalAction(btn.id)">
              {{ btn.text }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const targetUserId = ref(route.params.userId);
const jobId = ref(route.query.jobId);
const BASE_URL = 'https://impotently-dutiful-hare.cloudpub.ru';
const messagesContainer = ref(null);
const messageInput = ref(null);
const messages = ref([]);
const newMessage = ref('');
const nick = ref('Unknown');
const userPhoto = ref('');
const currentUserId = ref('');
const isOwner = ref(false);
const isInputFocused = ref(false);
const isMobile = ref(window.innerWidth <= 768);
const isBlocked = ref(false);

const showModal = ref(false);
const modalTitle = ref('');
const modalMessage = ref('');
const modalButtons = ref([]);
const modalCallback = ref(null);
const modalInput = ref(false);
const modalInputValue = ref('');

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
};

const fetchUserDetails = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/profile/${targetUserId.value}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    nick.value = response.data.nick || 'Unknown';
    userPhoto.value = response.data.photoUrl || 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp';
  } catch (error) {}
};

const fetchJobDetails = async () => {
  if (!jobId.value) return;
  try {
    const response = await axios.get(`${BASE_URL}/api/jobs`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    const job = response.data.find(j => j.id === jobId.value);


    if (job) {
      nick.value = job.nick || 'Unknown';
      isOwner.value = currentUserId.value === job.userId.toString();



    }
  } catch (error) {}
};

const fetchMessages = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/chat/${targetUserId.value}?jobId=${jobId.value}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    messages.value = response.data.map(msg => ({
      ...msg,
      isSender: msg.authorUserId.toString() === currentUserId.value
    }));
    scrollToBottom();
  } catch (error) {}
};

const checkChatStatus = async () => {
  try {
    const chatId = `${jobId.value}_${targetUserId.value}`;
    const blockCheck = await axios.get(`${BASE_URL}/api/chat/status/${chatId}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
    });
    isBlocked.value = blockCheck.data.blocked;
  } catch (error) {}
};
const sendMessage = async () => {
  if (!newMessage.value.trim()) return;
  try {
    const chatId = `${jobId.value}_${targetUserId.value}`;
    const blockCheck = await axios.get(`${BASE_URL}/api/chat/status/${chatId}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
    });
    if (blockCheck.data.blocked) {
      Telegram.WebApp.showAlert('Чат остановлен до вмешательства модерации и решения конфликта');
      isBlocked.value = true;

      return;
    }

    if (isOwner.value) {
      const response = await axios.post(
        `${BASE_URL}/api/chat/${targetUserId.value}`,
        { text: newMessage.value, jobId: jobId.value },
        { headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData } }
      );
      if (response.data.success) {
        fetchMessages();
        newMessage.value = '';
      }
    } else {
      const invoiceResponse = await axios.post(
        `${BASE_URL}/api/createMessageInvoice`,
        { targetUserId: targetUserId.value, text: newMessage.value, jobId: jobId.value },
        { headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData } }
      );
      if (invoiceResponse.data.success) {
        window.Telegram.WebApp.openInvoice(invoiceResponse.data.invoiceLink, (status) => {
          if (status === 'paid') {
            fetchMessages();
            newMessage.value = '';
            Telegram.WebApp.showAlert('Message sent successfully!');
          } else if (status === 'cancelled') {
            newMessage.value = '';
            Telegram.WebApp.showAlert('Payment cancelled.');
          }
        });
      }
    }
  } catch (error) {
    Telegram.WebApp.showAlert('Failed to send message.');
  }
};

const handleInputFocus = () => {
  if (isMobile.value) {
    isInputFocused.value = true;
  }
};

const handleInputBlur = () => {
  if (isMobile.value) {
    isInputFocused.value = false;
    messageInput.value.blur();
  }
};

const hideKeyboard = (event) => {
  if (messageInput.value && event.target !== messageInput.value && isMobile.value) {
    handleInputBlur();
  }
};

const handleResize = () => {
  isMobile.value = window.innerWidth <= 768;
};

const showCustomPopup = (options, callback) => {
  if (isMobile.value) {
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
  if (isMobile.value) {
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
  if (modalCallback.value) {
    modalCallback.value(buttonId, modalInput.value ? modalInputValue.value : undefined);
  }
  closeModal();
};

const closeModal = () => {
  showModal.value = false;
  modalCallback.value = null;
};

watch(() => route.params.userId, (newUserId) => {
  targetUserId.value = newUserId;
  fetchUserDetails();
  fetchMessages();
  checkChatStatus();
});

watch(() => route.query.jobId, (newJobId) => {
  jobId.value = newJobId;
  fetchJobDetails();
  fetchMessages();
  checkChatStatus();
});

onMounted(() => {
  if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    currentUserId.value = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
  } else {
    Telegram.WebApp.showAlert('Please open the app via Telegram.');
    return;
  }
  if (Telegram.WebApp.setHeaderColor) {
    Telegram.WebApp.setHeaderColor('#97f492');
  }
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
  fetchUserDetails();
  fetchJobDetails();
  fetchMessages();
  checkChatStatus();
  messageInput.value.addEventListener('focus', handleInputFocus);
  messageInput.value.addEventListener('blur', handleInputBlur);
  window.addEventListener('resize', handleResize);
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