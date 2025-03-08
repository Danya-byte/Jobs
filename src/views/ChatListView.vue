<template>
  <div class="container">
    <nav class="nav-bar">
      <h1>Chats</h1>
      <RouterLink to="/" class="home-button">Home</RouterLink>
    </nav>

    <div class="chat-list">
      <p v-if="chats.length === 0" class="no-chats">No chats available.</p>
      <RouterLink
        v-for="chat in chats"
        :key="chat.id"
        :to="{ path: `/chat/${chat.targetUserId}`, query: { username: chat.username, jobId: chat.jobId } }"
        class="chat-item"
      >
        <img :src="chat.photoUrl" class="chat-icon" loading="lazy" @error="handleImageError" />
        <div class="chat-info">
          <p class="nick">{{ chat.nick }}</p>
          <p class="last-message">{{ chat.lastMessage }}</p>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const BASE_URL = 'https://impotently-dutiful-hare.cloudpub.ru';
const chats = ref([]);
const defaultPhoto = 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp';
const currentUserId = ref(window.Telegram.WebApp.initDataUnsafe.user.id.toString());

const fetchChats = async () => {
  try {
    const messagesResponse = await axios.get(`${BASE_URL}/api/chats`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
    });
    const messages = messagesResponse.data.filter(msg =>
      msg.authorUserId.toString() === currentUserId.value ||
      msg.targetUserId.toString() === currentUserId.value
    );

    const jobsResponse = await axios.get(`${BASE_URL}/api/jobs`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
    });
    const jobs = jobsResponse.data;

    const chatMap = new Map();
    messages.forEach((msg) => {
      if (msg.jobId) {
        const otherUserId = msg.authorUserId.toString() === currentUserId.value
          ? msg.targetUserId.toString()
          : msg.authorUserId.toString();

        const key = `${msg.jobId}_${otherUserId}`;

        if (!chatMap.has(key)) {
          const job = jobs.find((j) => j.id === msg.jobId);
          if (job) {
            chatMap.set(key, {
              jobId: msg.jobId,
              targetUserId: otherUserId,
              messages: [],
              nick: '',
              username: job.username || '',
              photoUrl: '',
            });
          }
        }
        if (chatMap.has(key)) {
          chatMap.get(key).messages.push(msg);
        }
      }
    });

    const chatsArray = Array.from(chatMap.entries());
    for (const [key, chat] of chatsArray) {
      try {
        const userResponse = await axios.get(`${BASE_URL}/api/profile/${chat.targetUserId}`, {
          headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
        });
        chat.nick = userResponse.data.nick || 'Unknown';
        chat.photoUrl = userResponse.data.photoUrl || defaultPhoto;
        chatMap.set(key, chat);
      } catch (error) {
        chat.nick = 'Unknown';
        chat.photoUrl = defaultPhoto;
        chatMap.set(key, chat);
      }
    }

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
  fetchChats();
  if (Telegram.WebApp.setHeaderColor) {
    Telegram.WebApp.setHeaderColor('#97f492');
  }
});
</script>

<style scoped>
.container {
  background: linear-gradient(45deg, #101622, #1a2233);
  height: 100vh;
  padding: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-shrink: 0;
}

h1 {
  color: #97f492;
  font-size: 24px;
  margin: 0;
}

.home-button {
  background: linear-gradient(135deg, #97f492 0%, #6de06a 100%);
  padding: 8px 20px;
  border-radius: 30px;
  color: #000;
  font-weight: 400;
  text-decoration: none;
  box-shadow: 0 4px 15px rgba(151, 244, 146, 0.3);
  transition: 0.3s;
  font-size: 14px;
  animation: pulse 2s infinite;
}

.home-button:hover {
  transform: translateY(-2px);
}

.chat-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-list-wrapper {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.chat-list-wrapper::-webkit-scrollbar {
  display: none;
}

.chat-item {
  display: flex;
  align-items: center;
  gap: 15px;
  background: #181e29;
  border-radius: 20px;
  padding: 15px;
  text-decoration: none;
  border: 1px solid #2d3540;
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
  margin-bottom: 10px;
}

.chat-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
  border-color: #97f492;
}

.chat-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  object-fit: cover;
}

.chat-info {
  flex: 1;
}

.nick {
  color: #97f492;
  font-size: 16px;
  margin: 0;
}

.last-message {
  color: #8a8f98;
  font-size: 14px;
  margin: 0;
}

.no-chats {
  color: #8a8f98;
  font-size: 16px;
  text-align: center;
  padding: 20px;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
</style>