<template>
  <div class="chat-container">
    <div class="chat-header">
      <h2>Your Chats</h2>
      <button class="close-btn" @click="$router.push('/')">×</button>
    </div>
    <div class="chat-list">
      <div v-if="chatGroups.length === 0" class="no-chats">
        <p>No chats yet.</p>
      </div>
      <div v-else v-for="group in chatGroups" :key="group.userId" class="chat-group">
        <RouterLink
          :to="{ path: `/chat/${group.userId}`, query: { username: group.authorUsername, jobId: group.jobId } }"
          class="chat-link"
        >
          <div class="chat-preview">
            <p class="author">{{ group.authorName || 'Unknown' }}</p>
            <p class="last-message">{{ group.lastMessage || 'No messages' }}</p>
            <span class="timestamp">{{ group.timestamp ? formatTimestamp(group.timestamp) : '' }}</span>
          </div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const userId = ref(route.params.userId);
const BASE_URL = 'https://impotently-dutiful-hare.cloudpub.ru';
const chatGroups = ref([]);

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const fetchChats = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/owner-chats/${userId.value}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    chatGroups.value = response.data.chatGroups || [];
  } catch (error) {
    console.error('Ошибка при загрузке чатов:', error);
    chatGroups.value = [];
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
  fetchChats();
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
.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}
.chat-group {
  margin-bottom: 1rem;
}
.chat-link {
  display: block;
  text-decoration: none;
  background: #2d3540;
  padding: 1rem;
  border-radius: 1rem;
  color: #fff;
}
.chat-preview {
  display: flex;
  flex-direction: column;
}
.author {
  color: #97f492;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
}
.last-message {
  margin: 0;
  color: #c2c6cf;
}
.timestamp {
  font-size: 0.75rem;
  color: #8a8f98;
  margin-top: 0.25rem;
}
.no-chats {
  text-align: center;
  color: #8a8f98;
  padding: 2rem;
}
</style>