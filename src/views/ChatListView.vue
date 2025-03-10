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
          :to="{ path: `/chat/${chat.targetUserId}`, query: { username: chat.username, jobId: chat.jobId } }"
          class="chat-item"
          @touchstart="startSwipe($event, chat.id)"
          @touchmove="moveSwipe($event)"
          @touchend="endSwipe(chat.id)"
        >
          <img :src="chat.photoUrl" class="chat-icon" loading="lazy" @error="handleImageError" />
          <div class="chat-info">
            <p class="nick">{{ chat.nick }}</p>
            <p class="last-message">{{ chat.lastMessage }}</p>
          </div>
          <button class="options-btn" @click.stop="openOptions(chat.id)">⋮</button>
        </RouterLink>
      </div>
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
const swipeStartX = ref(null);
const swipeCurrentX = ref(null);
const activeChatId = ref(null);

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

const openOptions = (chatId) => {
  Telegram.WebApp.showPopup({
    title: 'Действия с чатом',
    message: 'Выберите действие',
    buttons: [
      { id: 'report', type: 'default', text: 'Пожаловаться' },
      { id: 'delete', type: 'destructive', text: 'Удалить чат' },
      { type: 'cancel', text: 'Отмена' },
    ],
  }, (buttonId) => {
    if (buttonId === 'report') {
      reportChat(chatId);
    } else if (buttonId === 'delete') {
      deleteChat(chatId);
    }
  });
};

const startSwipe = (event, chatId) => {
  swipeStartX.value = event.touches[0].clientX;
  activeChatId.value = chatId;
};

const moveSwipe = (event) => {
  if (swipeStartX.value === null) return;
  swipeCurrentX.value = event.touches[0].clientX;
};

const endSwipe = (chatId) => {
  if (swipeStartX.value !== null && swipeCurrentX.value !== null) {
    const deltaX = swipeCurrentX.value - swipeStartX.value;
    if (deltaX < -50) {
      openOptions(chatId);
    }
  }
  swipeStartX.value = null;
  swipeCurrentX.value = null;
  activeChatId.value = null;
};

const reportChat = async (chatId) => {
  Telegram.WebApp.showPopup({
    title: 'Пожаловаться',
    message: 'Выберите причину жалобы',
    buttons: [
      { id: 'spam', type: 'default', text: 'Спам' },
      { id: 'insult', type: 'default', text: 'Оскорбления' },
      { id: 'other', type: 'default', text: 'Другое' },
      { type: 'cancel', text: 'Отмена' },
    ],
  }, async (buttonId) => {
    let reportText = '';
    if (buttonId === 'spam') {
      reportText = 'Спам';
    } else if (buttonId === 'insult') {
      reportText = 'Оскорбления';
    } else if (buttonId === 'other') {
      Telegram.WebApp.showPopup({
        title: 'Укажите причину',
        message: 'Введите текст жалобы',
        buttons: [
          { id: 'submit', type: 'default', text: 'Отправить' },
          { type: 'cancel', text: 'Отмена' },
        ],
        input: true,
      }, async (submitButtonId, inputText) => {
        if (submitButtonId === 'submit' && inputText) {
          await submitReport(chatId, inputText);
        }
      });
      return;
    } else {
      return;
    }
    await submitReport(chatId, reportText);
  });
};

const submitReport = async (chatId, reportText) => {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/report`,
      { chatId, reason: reportText },
      { headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData } }
    );
    if (response.data.success) {
      Telegram.WebApp.showAlert('Жалоба отправлена');
      chats.value = chats.value.map(chat =>
        chat.id === chatId ? { ...chat, blocked: true } : chat
      );
    } else {
      Telegram.WebApp.showAlert('Ошибка при отправке жалобы');
    }
  } catch (error) {
    console.error('Error reporting chat:', error);
    Telegram.WebApp.showAlert('Ошибка при отправке жалобы');
  }
};

const deleteChat = async (chatId) => {
  Telegram.WebApp.showConfirm(
    'Вы точно хотите удалить данный чат? История чата не удаляется тоже',
    async (confirmed) => {
      if (confirmed) {
        try {
          const response = await axios.delete(`${BASE_URL}/api/chat/${chatId}`, {
            headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
          });
          if (response.data.success) {
            chats.value = chats.value.filter((chat) => chat.id !== chatId);
          } else {
            Telegram.WebApp.showAlert('Ошибка при удалении чата');
          }
        } catch (error) {
          console.error('Error deleting chat:', error);
          Telegram.WebApp.showAlert('Ошибка при удалении чата');
        }
      }
    }
  );
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