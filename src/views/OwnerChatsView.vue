<template>
  <div class="chat-view">
    <div class="chat-header">
      <h2>Чат с {{ username || 'Unknown' }}</h2>
      <button class="close-btn" @click="$router.go(-1)">×</button>
    </div>
    <div class="messages-container">
      <div v-if="messages.length === 0" class="no-messages">
        <p>Сообщений пока нет.</p>
      </div>
      <div v-else class="messages-list">
        <div v-for="message in messages" :key="message.id" :class="['message', { 'message-sent': message.isSender }]">
          <p>{{ message.text }}</p>
          <span class="timestamp">{{ formatTimestamp(message.timestamp) }}</span>
        </div>
      </div>
    </div>
    <div class="message-input">
      <input v-model="newMessage" placeholder="Введите сообщение..." @keyup.enter="sendMessage" />
      <button @click="sendMessage">Отправить</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const userId = ref(route.params.userId);
const targetUserId = ref(route.params.targetUserId);
const username = ref(route.query.username);
const jobId = ref(route.query.jobId);
const messages = ref([]);
const newMessage = ref('');
const BASE_URL = 'https://impotently-dutiful-hare.cloudpub.ru';

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const fetchMessages = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/messages/${userId.value}/${targetUserId.value}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    messages.value = response.data.messages || [];
  } catch (error) {
    console.error('Ошибка при загрузке сообщений:', error);
    messages.value = [];
  }
};

const sendMessage = async () => {
  if (!newMessage.value.trim()) return;

  try {
    const response = await axios.post(`${BASE_URL}/api/createMessageInvoice`, {
      targetUserId: targetUserId.value,
      text: newMessage.value,
      jobId: jobId.value
    }, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });

    if (response.data.success && response.data.message === 'Message sent without payment') {
      await fetchMessages();
    } else if (response.data.invoiceLink) {
      window.Telegram.WebApp.openInvoice(response.data.invoiceLink, async (status) => {
        if (status === 'paid') {
          await fetchMessages();
        }
      });
    }

    newMessage.value = '';
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
  }
};

onMounted(() => {
  if (!window.Telegram?.WebApp?.initData) {
    console.error('Telegram WebApp не инициализирован');
    Telegram.WebApp.showAlert('Пожалуйста, откройте приложение через Telegram.');
    return;
  }
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
  fetchMessages();
});
</script>

<style scoped>
.chat-view {
  background: linear-gradient(45deg, #101622, #1a2233);
  height: 100vh;
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

.chat-header {
  padding: 0.8rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h2 {
  color: #97f492;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.75rem;
  cursor: pointer;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.no-messages {
  text-align: center;
  color: #8a8f98;
  padding: 2rem;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.message {
  max-width: 70%;
  padding: 0.5rem 1rem;
  border-radius: 1rem;
  background: #2d3540;
  color: #c2c6cf;
}

.message-sent {
  background: #97f492;
  color: #101622;
  align-self: flex-end;
}

.message p {
  margin: 0;
}

.message .timestamp {
  font-size: 0.75rem;
  color: #8a8f98;
  margin-top: 0.25rem;
  display: block;
  text-align: right;
}

.message-input {
  padding: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 1rem;
}

.message-input input {
  flex: 1;
  padding: 0.5rem;
  border: none;
  border-radius: 0.5rem;
  background: #2d3540;
  color: #fff;
}

.message-input button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.5rem;
  background: #97f492;
  color: #101622;
  cursor: pointer;
}
</style>