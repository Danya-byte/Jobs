<template>
  <div class="chat-container" @click="hideKeyboard">
    <div class="chat-header">
      <h2>{{ nick || 'Unknown' }}</h2>
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
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const router = useRouter();
const userId = ref(route.params.userId);
const nick = ref(route.query.nick);
const BASE_URL = 'https://impotently-dutiful-hare.cloudpub.ru';
const messagesContainer = ref(null);
const messageInput = ref(null);

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

const hideKeyboard = (event) => {
  if (event.target !== messageInput.value) {
    messageInput.value.blur();
  }
};

onMounted(() => {
  if (window.Telegram?.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();

  if (Telegram.WebApp.setHeaderColor) {
      Telegram.WebApp.setHeaderColor('#97f492');
    }
  }
  fetchJobDetails();
  fetchMessages();
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
  overflow: hidden;
}

.chat-header {
  padding: 0.8rem 1rem;
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
  padding: 0 0.5rem;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: clamp(0.5rem, 2vw, 1rem);
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}

.message {
  margin: 0.5rem 0;
  padding: clamp(0.5rem, 2vw, 0.75rem) clamp(0.75rem, 2.5vw, 1rem);
  border-radius: clamp(0.75rem, 3vw, 1rem);
  width: fit-content;
  max-width: clamp(70%, 75vw, 75%);
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
  font-size: clamp(0.625rem, 2vw, 0.75rem);
  color: #8a8f98;
  margin-top: 0.25rem;
  display: block;
}

.chat-input {
  padding: clamp(0.5rem, 2vw, 1rem) clamp(0.5rem, 2vw, 1rem) !important;
  display: flex;
  gap: clamp(0.5rem, 2vw, 0.75rem);
  background: #1a2233;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  position: sticky;
  bottom: 0;
  align-items: center;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
  min-height: clamp(3rem, 10vw, 4rem);
}

.message-input {
  flex: 1;
  padding: clamp(0.5rem, 2vw, 0.75rem) clamp(0.75rem, 2.5vw, 1rem);
  border-radius: clamp(1rem, 4vw, 1.25rem);
  border: none;
  background: #272e38;
  color: #fff;
  font-size: clamp(0.875rem, 3vw, 1rem);
  outline: none;
  min-height: clamp(2.5rem, 8vw, 3rem) !important;
  margin-bottom: 0 !important;
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
  transition: background 0.2s;
}

.send-btn svg {
  fill: #000;
  width: clamp(1.25rem, 4vw, 1.5rem);
  height: clamp(1.25rem, 4vw, 1.5rem);
}

.send-btn:hover {
  background: #6de06a;
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
    padding: clamp(0.5rem, 2vw, 0.75rem) clamp(0.5rem, 2vw, 1rem);
    min-height: 4rem;
  }

  .message-input {
    min-height: 3.5rem !important;
    padding: 12px 12px !important;
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
    padding: clamp(0.75rem, 2vw, 1rem) clamp(0.5rem, 2vw, 1rem);
    min-height: 4rem;
  }

  .message-input {
    min-height: 3rem !important;
    padding: 8px 16px !important;
  }

  .send-btn {
    width: 3rem !important;
    height: 3rem !important;
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