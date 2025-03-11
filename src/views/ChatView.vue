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
import { ref, onMounted, nextTick, watch, onUnmounted } from 'vue';
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
      Telegram.WebApp.showAlert('Чат заблокирован для обоих пользователей до решения модерации');
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
    if (error.response?.status === 403) {
      Telegram.WebApp.showAlert('Чат заблокирован для обоих пользователей до решения модерации');
      isBlocked.value = true;
    } else {
      Telegram.WebApp.showAlert('Failed to send message.');
    }
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

  const pollInterval = setInterval(fetchMessages, 5000);
  onUnmounted(() => clearInterval(pollInterval));
});
</script>

<style scoped>
.chat-container {
  background: linear-gradient(45deg, #101622, #1a2233);
  height: 100vh;
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
  position: relative;
}

.chat-header {
  padding: 0.8rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  background: linear-gradient(45deg, #101622, #1a2233);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  z-index: 1;
}

.back-btn {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 0.5rem;
  transition: background 0.2s;
}

.back-btn:hover {
  background: rgba(151, 244, 146, 0.2);
}

.back-btn svg {
  stroke: #fff;
  stroke-width: 2;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  aspect-ratio: 1/1;
}

.chat-header h2 {
  color: #97f492;
  margin: 0;
  font-size: clamp(1rem, 3.5vw, 1.25rem);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 70%;
}

.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: clamp(1.5rem, 5vw, 1.75rem);
  cursor: pointer;
  padding: 0.5rem;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(151, 244, 146, 0.2);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #97f492 transparent;
  padding: clamp(0.5rem, 2vw, 1rem);
}

.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #97f492;
  border-radius: 4px;
}

.message {
  margin: 0.5rem 0;
  padding: clamp(0.5rem, 2vw, 0.75rem) clamp(0.75rem, 2.5vw, 1rem);
  border-radius: clamp(0.75rem, 3vw, 1rem);
  width: fit-content;
  max-width: clamp(70%, 75vw, 75%);
  word-wrap: break-word;
  animation: slideIn 0.2s ease-out;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.sent {
  background: linear-gradient(135deg, #97f492 0%, #6de06a 100%);
  color: #000;
  margin-left: auto;
  border-radius: 15px 15px 0 15px;
}

.received {
  background: linear-gradient(135deg, #2d3540 0%, #1a2233 100%);
  color: #fff;
  border-radius: 15px 15px 15px 0;
}

.timestamp {
  font-size: clamp(0.6rem, 1.5vw, 0.7rem);
  color: #8a8f98;
  margin-top: 0.25rem;
  display: block;
  opacity: 0.7;
}

.chat-input {
  padding: clamp(0.5rem, 2vw, 1rem);
  display: flex;
  gap: clamp(0.5rem, 2vw, 0.75rem);
  background: #1a2233;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
  align-items: center;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  min-height: clamp(3rem, 10vw, 4rem);
  position: relative;
  z-index: 2;
}

.message-input {
  flex: 1;
  padding: clamp(0.5rem, 2vw, 0.75rem) clamp(0.75rem, 2.5vw, 1rem);
  border-radius: 20px;
  border: none;
  background: #272e38;
  color: #fff;
  font-size: clamp(0.875rem, 3vw, 1rem);
  outline: none;
  min-height: clamp(2.5rem, 8vw, 3rem);
  transition: box-shadow 0.2s ease;
}

.message-input:focus {
  box-shadow: 0 0 5px rgba(151, 244, 146, 0.5);
  border: 1px solid #97f492;
}

.send-btn {
  background: #97f492;
  border: none;
  border-radius: 50%;
  width: clamp(2.5rem, 8vw, 3rem);
  height: clamp(2.5rem, 8vw, 3rem);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}

.send-btn:hover {
  background: #6de06a;
  transform: scale(1.05);
}

.send-btn svg {
  fill: #000;
  width: clamp(1.25rem, 4vw, 1.5rem);
  height: clamp(1.25rem, 4vw, 1.5rem);
}

.chat-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3;
}

.overlay-text {
  color: #fff;
  font-size: 16px;
  text-align: center;
  padding: 20px;
  background: rgba(40, 48, 62, 0.8);
  border-radius: 10px;
  max-width: 80%;
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

@media (max-width: 768px) {
  .chat-container {
    max-width: 100%;
    border-radius: 0;
    box-shadow: none;
    height: 100dvh;
  }
  .chat-header {
    padding: 0.5rem;
  }
  .message {
    max-width: 85%;
  }
  .chat-input {
    padding: clamp(0.5rem, 2vw, 0.75rem);
    min-height: 4rem;
  }
  .message-input {
    min-height: 3.5rem;
    padding: 12px;
  }
  .send-btn {
    width: 3rem;
    height: 3rem;
  }
  .send-btn svg {
    width: 1.5rem;
    height: 1.5rem;
  }
}

@media (min-width: 769px) {
  .chat-container {
    border-radius: 12px;
    margin: 1rem auto;
    height: calc(100vh - 2rem);
  }
  .chat-messages {
    padding: 1.5rem;
  }
  .message {
    max-width: 70%;
  }
  .chat-input {
    padding: clamp(0.75rem, 2vw, 1rem);
    min-height: 4rem;
  }
  .message-input {
    min-height: 3rem;
    padding: 8px 16px;
  }
  .send-btn {
    width: 3rem;
    height: 3rem;
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>