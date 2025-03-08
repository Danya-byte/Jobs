<template>
  <div class="chat-list-container">
    <h2>Chats</h2>
    <div class="chat-list">
      <div v-if="chats.length === 0" class="no-chats">
        No chats available.
      </div>
      <router-link
        v-for="chat in chats"
        :key="chat.id"
        :to="{ path: `/chat/${chat.targetUserId}`, query: { jobId: chat.jobId, username: chat.username } }"
        class="chat-item"
      >
        <img :src="chat.photoUrl || defaultPhoto" class="chat-avatar" loading="lazy" @error="handleImageError" />
        <div class="chat-info">
          <p class="chat-nick">{{ chat.nick }}</p>
          <p class="last-message">{{ chat.lastMessage }}</p>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const BASE_URL = 'https://impotently-dutiful-hare.cloudpub.ru';
const defaultPhoto = 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp';
const chats = ref([]);
const currentUserId = ref('');

const fetchChats = async () => {
  try {
    const jobsResponse = await axios.get(`${BASE_URL}/api/jobs`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
    });
    const ownedJobs = jobsResponse.data.filter((job) => job.userId.toString() === currentUserId.value);

    const messagesResponse = await axios.get(`${BASE_URL}/api/chats`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
    });
    const messages = messagesResponse.data;

    const chatMap = new Map();
    messages.forEach((msg) => {
      if (msg.jobId && (msg.targetUserId === currentUserId.value || msg.authorUserId === currentUserId.value)) {
        const job = ownedJobs.find((j) => j.id === msg.jobId);
        if (job) {
          const key = `${msg.jobId}_${msg.authorUserId === currentUserId.value ? msg.targetUserId : msg.authorUserId}`;
          if (!chatMap.has(key)) {
            chatMap.set(key, {
              jobId: msg.jobId,
              targetUserId: msg.authorUserId === currentUserId.value ? msg.targetUserId : msg.authorUserId,
              messages: [],
              nick: job.nick,
              username: job.username || '',
              photoUrl: job.username ? `https://t.me/i/userpic/160/${job.username}.jpg` : defaultPhoto,
            });
          }
          chatMap.get(key).messages.push(msg);
        }
      }
    });

    chats.value = Array.from(chatMap.values()).map((chat) => {
      const lastMessage = chat.messages[chat.messages.length - 1];
      return {
        id: `${chat.jobId}_${chat.targetUserId}`,
        targetUserId: chat.targetUserId,
        jobId: chat.jobId,
        nick: chat.nick,
        username: chat.username,
        photoUrl: chat.photoUrl,
        lastMessage: lastMessage.text.slice(0, 30) + (lastMessage.text.length > 30 ? '...' : ''),
      };
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
  }
};

const handleImageError = (event) => {
  event.target.src = defaultPhoto;
};

onMounted(() => {
  if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    currentUserId.value = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
    fetchChats();
  } else {
    Telegram.WebApp.showAlert('Please open the app via Telegram.');
  }
});
</script>

<style scoped>
.chat-list-container {
  background: linear-gradient(45deg, #101622, #1a2233);
  min-height: 100vh;
  padding: 20px;
  color: #fff;
}

h2 {
  color: #97f492;
  margin-bottom: 20px;
}

.chat-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.chat-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: #181e29;
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s, box-shadow 0.2s;
}

.chat-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.chat-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.chat-info {
  flex: 1;
}

.chat-nick {
  color: #97f492;
  font-size: 16px;
  margin: 0;
}

.last-message {
  color: #8a8f98;
  font-size: 14px;
  margin: 5px 0 0 0;
}

.no-chats {
  color: #8a8f98;
  text-align: center;
  padding: 20px;
}
</style>