<template>
  <div class="container">
    <nav class="nav-bar">
      <h1>My chats</h1>
      <RouterLink to="/" class="home-button">Home</RouterLink>
    </nav>

    <div class="chat-list">
      <p v-if="chats.length === 0" class="no-chats">No chats available.</p>
      <div class="chat-list-wrapper">
        <RouterLink
          v-for="chat in chats"
          :key="chat.id"
          @touchstart="touchStart($event, chat.id)"
          @touchmove="touchMove"
          @touchend="touchEnd(chat.id)"
          :to="{ path: `/chat/${chat.targetUserId}`, query: { username: chat.username, jobId: chat.jobId } }"
          class="chat-item"
        >
          <img :src="chat.photoUrl" class="chat-icon" loading="lazy" @error="handleImageError" />
          <div class="chat-info">
            <p class="nick">{{ chat.nick }}</p>
            <p class="last-message">{{ chat.lastMessage }}</p>
          </div>
          <button class="options-btn" @click.stop="openOptions(chat.id)">⋮</button>
          <div v-if="showContextMenu === chat.id" class="context-menu">
            <button @click="reportChat(chat.id)">Пожаловаться</button>
            <button @click="deleteChat(chat.id)">Удалить чат</button>
          </div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';
import { useModal } from 'vue-final-modal';
import ConfirmationModal from './ConfirmationModal.vue';

const BASE_URL = 'https://impotently-dutiful-hare.cloudpub.ru';
const chats = ref([]);
const defaultPhoto = 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp';
const currentUserId = ref(window.Telegram.WebApp.initDataUnsafe.user.id.toString());
const touch = reactive({ startX: 0, offset: 0 });
const showContextMenu = ref(null);

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
              lastMessageTime: new Date(0),
            });
          }
        }
        if (chatMap.has(key)) {
          chatMap.get(key).messages.push(msg);
          const msgTime = new Date(msg.timestamp);
          if (msgTime > chatMap.get(key).lastMessageTime) {
            chatMap.get(key).lastMessageTime = msgTime;
          }
        }
      }
    });

    const sortedChats = Array.from(chatMap.values()).sort((a, b) => b.lastMessageTime - a.lastMessageTime);

    for (const chat of sortedChats) {
      try {
        const userResponse = await axios.get(`${BASE_URL}/api/profile/${chat.targetUserId}`, {
          headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
        });
        chat.nick = userResponse.data.nick || 'Unknown';
        chat.photoUrl = userResponse.data.photoUrl || defaultPhoto;
      } catch (error) {
        chat.nick = 'Unknown';
        chat.photoUrl = defaultPhoto;
      }
    }

    chats.value = sortedChats.map((chat) => {
      const lastMessage = chat.messages[chat.messages.length - 1];
      return {
        id: `${chat.jobId}_${chat.targetUserId}`,
        targetUserId: chat.targetUserId,
        jobId: chat.jobId,
        nick: chat.nick,
        username: chat.username,
        photoUrl: chat.photoUrl,
        lastMessage: lastMessage.text.slice(0, 30) + (lastMessage.text.length > 30 ? '...' : ''),
        lastMessageTime: chat.lastMessageTime,
      };
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
  }
};

const handleImageError = (event) => {
  event.target.src = defaultPhoto;
};

const touchStart = (e, chatId) => {
  if (window.innerWidth > 768) return;
  touch.startX = e.touches[0].clientX;
  touch.chatId = chatId;
};

const touchMove = (e) => {
  if (window.innerWidth > 768) return;
  touch.offset = e.touches[0].clientX - touch.startX;
};

const touchEnd = (chatId) => {
  if (window.innerWidth > 768) return;
  if (touch.offset < -50) {
    showContextMenu.value = chatId;
  }
  touch.offset = 0;
};

const openOptions = (chatId) => {
  if (window.innerWidth <= 768) return;
  showContextMenu.value = chatId;
};

const reportChat = async (chatId) => {
  const { open, close } = useModal({
    component: ConfirmationModal,
    attrs: {
      title: 'Причина жалобы',
      options: ['Спам', 'Оскорбления', 'Другое'],
      allowCustom: true,
      onConfirm: async (reason) => {
        try {
          const response = await axios.post(
            `${BASE_URL}/api/report`,
            { chatId, reason },
            { headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData } }
          );
          if (response.data.success) {
            chats.value = chats.value.map(chat =>
              chat.id === chatId ? { ...chat, blocked: true } : chat
            );
          }
        } catch (error) {
          console.error(error);
        }
        close();
      }
    }
  });
  open();
};

const deleteChat = async (chatId) => {
  const { open, close } = useModal({
    component: ConfirmationModal,
    attrs: {
      title: 'Удалить чат?',
      message: 'История чата сохранится в архиве',
      onConfirm: async () => {
        try {
          const response = await axios.delete(`${BASE_URL}/api/chat/${chatId}`, {
            headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
          });
          if (response.data.success) {
            chats.value = chats.value.filter(c => c.id !== chatId);
          }
        } catch (error) {
          console.error(error);
        }
        close();
      }
    }
  });
  open();
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
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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
  font-size: 28px;
  margin: 0;
  font-family: 'Inter', system-ui;
  font-weight: 600;
  letter-spacing: -0.03em;
  text-shadow: 0 2px 4px rgba(151, 244, 146, 0.2);
}

.home-button {
  background: linear-gradient(135deg, #97f492 0%, #6de06a 100%);
  padding: 8px 20px;
  border-radius: 30px;
  color: #000;
  font-weight: 400;
  text-decoration: none;
  box-shadow: 0 4px 15px rgba(151, 244, 146, 0.3);
  transition: transform 0.3s, background 0.3s;
}

.home-button:hover {
  transform: translateY(-2px);
  background: #6de06a;
}

.chat-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-list-wrapper {
  flex: 1;
  overflow-y: scroll;
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
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  margin-bottom: 10px;
  position: relative;
}

.chat-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
  border-color: #97f492;
  background: #1f2633;
}

.chat-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  object-fit: cover;
  aspect-ratio: 1/1;
}

.chat-info {
  flex: 1;
}

.nick {
  color: #97f492;
  font-size: 16px;
  margin: 0;
  font-family: 'Inter', system-ui;
  font-weight: 600;
  letter-spacing: -0.03em;
}

.last-message {
  color: #b0b5bf;
  font-size: 14px;
  margin: 0;
  line-height: 1.4;
}

.no-chats {
  color: #97f492;
  font-size: 16px;
  text-align: center;
  padding: 20px;
}

.options-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  padding: 0.5rem;
  transition: background 0.2s;
}

.options-btn:hover {
  background: rgba(151, 244, 146, 0.2);
}

.context-menu {
  position: absolute;
  right: 0;
  top: 0;
  background: #1a2233;
  border: 1px solid #2d3540;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 10;
}

.context-menu button {
  padding: 8px 12px;
  background: #272e38;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  transition: background 0.2s;
}

.context-menu button:hover {
  background: #97f492;
  color: #000;
}

@media (max-width: 768px) {
  .chat-icon {
    width: 48px;
    height: 48px;
  }
  .home-button {
    padding: 8px 16px;
  }
}

@media (min-height: 500px) and (orientation: landscape) {
  .chat-header {
    padding: 0.5rem;
  }
  .user-avatar {
    width: 32px;
    height: 32px;
  }
}
</style>