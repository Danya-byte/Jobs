<template>
  <div class="chat-view">
    <div class="chat-header">
      <button class="close-btn" @click="$router.push(`/owner-chats/${userId.value}`)">×</button>
      <h2>{{ username }}</h2>
    </div>
    <div class="messages" ref="messagesContainer">
      <div v-for="message in messages" :key="message.id" :class="['message', { 'sent': message.isSender, 'received': !message.isSender }]">
        <div class="message-content">{{ message.text }}</div>
        <div class="message-timestamp">{{ formatTimestamp(message.timestamp) }}</div>
      </div>
    </div>
    <div class="message-input">
      <input v-model="newMessage" @keyup.enter="sendMessage" placeholder="Напишите сообщение..." />
      <button @click="sendMessage">Отправить</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';

const BASE_URL = 'https://impotently-dutiful-hare.cloudpub.ru';
const route = useRoute();
const userId = ref(JSON.parse(new URLSearchParams(window.Telegram.WebApp.initData).get('user')).id);
const jobId = ref(route.query.jobId);
const username = ref(route.query.username);
const messages = ref([]);
const newMessage = ref('');
const messagesContainer = ref(null);

const fetchMessages = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/chat/${route.params.userId}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
      params: { jobId: jobId.value }
    });
    messages.value = response.data;
    nextTick(() => scrollToBottom());
  } catch (error) {
    console.error('Ошибка при загрузке сообщений:', error);
  }
};

const sendMessage = async () => {
  if (!newMessage.value.trim()) return;
  const isOwner = userId.value === JSON.parse(new URLSearchParams(window.Telegram.WebApp.initData).get('user')).id;
  if (isOwner) {
    const message = {
      id: `${userId.value}_${Date.now()}`,
      text: newMessage.value,
      authorUserId: userId.value,
      targetUserId: route.params.userId,
      jobId: jobId.value,
      timestamp: new Date().toISOString(),
      isSender: true
    };
    try {
      await axios.post(`${BASE_URL}/api/chat/${route.params.userId}`, message, {
        headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
      });
      messages.value.push(message);
      newMessage.value = '';
      scrollToBottom();
    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error);
    }
  } else {
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
            Telegram.WebApp.showAlert('Сообщение успешно отправлено!');
          }
        });
      }
    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error);
    }
  }
};

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

onMounted(() => {
  fetchMessages();
});
</script>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 10px;
  box-sizing: border-box;
}

.chat-header {
  display: flex;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #ddd;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  margin-right: 10px;
}

h2 {
  flex: 1;
  font-size: 20px;
  text-align: center;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.message {
  max-width: 70%;
  padding: 10px;
  border-radius: 10px;
  position: relative;
}

.sent {
  background-color: #4caf50;
  color: white;
  align-self: flex-end;
}

.received {
  background-color: #f1f1f1;
  align-self: flex-start;
}

.message-content {
  word-wrap: break-word;
}

.message-timestamp {
  font-size: 10px;
  color: #888;
  text-align: right;
  margin-top: 5px;
}

.message-input {
  display: flex;
  padding: 10px;
  border-top: 1px solid #ddd;
  background: #fff;
}

input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  margin-right: 10px;
}

button {
  padding: 10px 20px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

button:hover {
  background-color: #45a049;
}
</style>