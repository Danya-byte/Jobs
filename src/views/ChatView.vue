<template>
  <div class="chat-container">
    <div class="chat-header">
      <h2>{{ nick || 'Unknown' }}</h2>
      <button class="close-btn" @click="$router.push('/')">×</button>
    </div>
    <div class="chat-messages" ref="messagesContainer" v-if="chatUnlocked">
      <div v-for="(message, index) in messages" :key="index"
           :class="['message', message.isSender ? 'sent' : 'received']">
        <p>{{ message.text }}</p>
        <span class="timestamp">{{ formatTimestamp(message.timestamp) }}</span>
      </div>
    </div>
    <div class="chat-locked" v-else>
      <p>Pay 1 XTR to unlock chat</p>
      <button class="pay-btn" @click="requestPayment">Unlock (1 XTR)</button>
    </div>
    <div class="chat-input" v-if="chatUnlocked">
      <input v-model="newMessage" placeholder="Type a message..."
             @keyup.enter="sendMessage" class="message-input">
      <button @click="sendMessage" class="send-btn">
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const router = useRouter();
const userId = ref(route.params.userId);
const jobId = ref(route.query.jobId);
const BASE_URL = 'https://impotently-dutiful-hare.cloudpub.ru';
const messagesContainer = ref(null);

const chatUnlocked = ref(false);
const messages = ref([]);
const newMessage = ref('');
const nick = ref('Unknown');

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

const fetchJobDetails = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/jobs`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    const job = response.data.find(job => job.id === jobId.value);
    if (job) {
      nick.value = job.nick;
    }
  } catch (error) {
    console.error('Error fetching job details:', error);
  }
};

const requestPayment = async () => {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/createChatInvoice`,
      { targetUserId: userId.value, jobId: jobId.value },
      { headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData } }
    );
    if (response.data.success) {
      window.Telegram.WebApp.openInvoice(response.data.invoiceLink, (status) => {
        if (status === 'paid') {
          chatUnlocked.value = true;
          Telegram.WebApp.showAlert('Chat unlocked successfully!');
          fetchMessages();
        } else if (status === 'cancelled') {
          Telegram.WebApp.showAlert('Payment cancelled.');
        }
      });
    }
  } catch (error) {
    console.error('Error requesting payment:', error);
    Telegram.WebApp.showAlert('Failed to initiate payment.');
  }
};

const fetchMessages = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/chat/${userId.value}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    messages.value = response.data.messages.map(msg => ({
      ...msg,
      isSender: msg.authorUserId === JSON.parse(new URLSearchParams(window.Telegram.WebApp.initData).get('user')).id
    }));
    scrollToBottom();
  } catch (error) {
    console.error('Error fetching messages:', error);
  }
};

const sendMessage = async () => {
  if (!newMessage.value.trim()) return;
  try {
    const response = await axios.post(
      `${BASE_URL}/api/createMessageInvoice`,
      { targetUserId: userId.value, text: newMessage.value, jobId: jobId.value },
      { headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData } }
    );
    if (response.data.success) {
      window.Telegram.WebApp.openInvoice(response.data.invoiceLink, (status) => {
        if (status === 'paid') {
          fetchMessages();
          newMessage.value = '';
          Telegram.WebApp.showAlert('Message sent successfully!');
        } else if (status === 'cancelled') {
          Telegram.WebApp.showAlert('Payment cancelled.');
          newMessage.value = '';
        }
      });
    }
  } catch (error) {
    console.error('Error sending message:', error);
    Telegram.WebApp.showAlert('Failed to initiate payment.');
  }
};

onMounted(() => {
  if (window.Telegram?.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
  }
  fetchJobDetails();
  checkChatStatus();
});

const checkChatStatus = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/chat/status/${userId.value}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    chatUnlocked.value = response.data.unlocked;
    if (chatUnlocked.value) fetchMessages();
  } catch (error) {
    console.error('Error checking chat status:', error);
  }
};
</script>

<style scoped>
.chat-container {
  background: linear-gradient(45deg, #101622, #1a2233);
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.chat-header {
  padding: 10px 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  background: inherit;
  z-index: 1;
}

.chat-header h2 {
  color: #97f492;
  margin: 0;
  font-size: clamp(16px, 4vw, 20px);
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: clamp(24px, 6vw, 28px);
  cursor: pointer;
  padding: 0 10px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}

.message {
  margin: 8px 0;
  padding: 10px 15px;
  border-radius: 16px;
  max-width: 75%;
  word-wrap: break-word;
  animation: slideIn 0.2s ease-out;
}

.sent {
  background: #97f492;
  color: #000;
  margin-left: auto;
}

.received {
  background: #2d3540;
  color: #fff;
}

.timestamp {
  font-size: clamp(10px, 2.5vw, 12px);
  color: #8a8f98;
  margin-top: 4px;
  display: block;
}

.chat-locked {
  flex: 1;
  display: grid;
  place-items: center;
  color: #fff;
  text-align: center;
  padding: 20px;
}

.pay-btn {
  background: linear-gradient(135deg, #97f492 0%, #6de06a 100%);
  color: #000;
  padding: 10px 20px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: clamp(14px, 3.5vw, 16px);
  transition: transform 0.2s;
}

.pay-btn:hover {
  transform: scale(1.02);
}

.chat-input {
  padding: 10px;
  display: flex;
  gap: 10px;
  background: inherit;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  position: sticky;
  bottom: 0;
}

.message-input {
  flex: 1;
  padding: 12px 15px;
  border-radius: 20px;
  border: none;
  background: #272e38;
  color: #fff;
  font-size: clamp(14px, 3.5vw, 16px);
  outline: none;
}

.send-btn {
  background: #97f492;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.2s;
}

.send-btn svg {
  fill: #000;
}

.send-btn:hover {
  background: #6de06a;
}

@media (max-width: 480px) {
  .chat-messages {
    padding: 10px;
  }

  .message {
    max-width: 85%;
  }

  .chat-input {
    padding: 8px;
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