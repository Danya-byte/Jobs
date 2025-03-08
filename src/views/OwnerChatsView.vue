<template>
  <div class="owner-chats">
    <h2>Чаты по вашей вакансии</h2>
    <div v-if="chatGroups.length === 0" class="no-chats">
      Пока нет чатов
    </div>
    <div v-else class="chat-list">
      <RouterLink
        v-for="group in chatGroups"
        :key="group.userId"
        :to="{ path: `/chat/${group.userId}`, query: { username: group.authorUsername, jobId: jobId } }"
        class="chat-item"
      >
        <div class="chat-info">
          <div class="chat-username">{{ group.authorUsername }}</div>
          <div class="last-message">{{ group.lastMessage.text }}</div>
        </div>
        <div class="chat-meta">
          <div class="timestamp">{{ formatTimestamp(group.lastMessage.timestamp) }}</div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';

const BASE_URL = 'https://impotently-dutiful-hare.cloudpub.ru';
const route = useRoute();
const userId = ref(route.params.userId || JSON.parse(new URLSearchParams(window.Telegram.WebApp.initData).get('user')).id);
const jobId = ref(route.query.jobId);
const chatGroups = ref([]);

const fetchChats = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/owner-chats/${userId.value}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    chatGroups.value = response.data;
  } catch (error) {
    console.error('Ошибка при загрузке чатов:', error);
  }
};

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

onMounted(() => {
  fetchChats();
});
</script>

<style scoped>
.owner-chats {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

h2 {
  font-size: 24px;
  margin-bottom: 20px;
  text-align: center;
}

.no-chats {
  text-align: center;
  color: #888;
  font-size: 18px;
}

.chat-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chat-item {
  display: flex;
  justify-content: space-between;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 10px;
  text-decoration: none;
  color: #000;
}

.chat-info {
  display: flex;
  flex-direction: column;
}

.chat-username {
  font-weight: bold;
  font-size: 16px;
}

.last-message {
  font-size: 14px;
  color: #555;
}

.chat-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.timestamp {
  font-size: 12px;
  color: #888;
}
</style>