<template>
  <div class="chat-container">
    <div class="chat-header">
      <button class="back-button" @click="goBack">←</button>
      <div class="chat-title">
        <span>{{ targetUserDetails.firstName || 'Пользователь' }}</span>
        <span class="job-title">{{ jobDetails.title || 'Название вакансии' }}</span>
      </div>
      <div class="chat-actions">
        <button class="report-button" @click="reportChat">Пожаловаться</button>
        <button class="delete-button" @click="deleteChat">Удалить</button>
      </div>
    </div>
    <div v-if="isChatDeleted" class="chat-deleted-overlay">
      <p class="overlay-text">Чат удалён</p>
    </div>
    <div v-else-if="isBlocked" class="chat-overlay">
      <p class="overlay-text">Чат остановлен до вмешательства модерации и решения конфликта</p>
    </div>
    <div v-else class="messages-container" ref="messagesContainer">
      <div v-for="message in messages" :key="message.id" :class="['message', message.authorUserId === currentUserId ? 'sent' : 'received']">
        <span class="message-text">{{ message.text }}</span>
        <span class="message-time">{{ formatTime(message.timestamp) }}</span>
      </div>
    </div>
    <div v-if="!isChatDeleted && !isBlocked" class="input-container">
      <textarea ref="messageInput" v-model="newMessage" @keydown.enter.prevent="sendMessage" placeholder="Введите сообщение..." rows="1"></textarea>
      <button class="send-button" @click="sendMessage">Отправить</button>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default {
  name: 'ChatPage',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const jobId = ref(route.params.jobId);
    const targetUserId = ref(route.params.targetUserId);
    const currentUserId = ref('');
    const messages = ref([]);
    const newMessage = ref('');
    const messagesContainer = ref(null);
    const messageInput = ref(null);
    const targetUserDetails = ref({});
    const jobDetails = ref({});
    const isChatDeleted = ref(false);
    const isBlocked = ref(false);

    const validateParams = () => {
      if (!jobId.value || !targetUserId.value) {
        Telegram.WebApp.showAlert('Ошибка: отсутствуют необходимые параметры чата');
        router.push('/chats');
        return false;
      }
      return true;
    };

    const fetchUserDetails = async () => {
      try {
        const response = await axios.get(`${BASE_URL}/api/user/${targetUserId.value}`, {
          headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
        });
        targetUserDetails.value = response.data;
      } catch (error) {
        Telegram.WebApp.showAlert('Ошибка при загрузке данных пользователя');
      }
    };

    const fetchJobDetails = async () => {
      try {
        const response = await axios.get(`${BASE_URL}/api/job/${jobId.value}`, {
          headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
        });
        jobDetails.value = response.data;
      } catch (error) {
        Telegram.WebApp.showAlert('Ошибка при загрузке данных вакансии');
      }
    };

    const fetchMessages = async () => {
      try {
        const response = await axios.get(`${BASE_URL}/api/messages/${jobId.value}/${targetUserId.value}`, {
          headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
        });
        messages.value = response.data.sort((a, b) => a.timestamp - b.timestamp);
        setTimeout(() => scrollToBottom(), 100);
      } catch (error) {
        if (error.response?.status === 404) {
          isChatDeleted.value = true;
        }
      }
    };

    const sendMessage = async () => {
      if (!newMessage.value.trim()) return;
      try {
        await axios.post(
          `${BASE_URL}/api/messages`,
          {
            jobId: jobId.value,
            targetUserId: targetUserId.value,
            text: newMessage.value,
          },
          { headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData } }
        );
        newMessage.value = '';
        fetchMessages();
      } catch (error) {
        Telegram.WebApp.showAlert('Ошибка при отправке сообщения');
      }
    };

    const scrollToBottom = () => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    };

    const formatTime = (timestamp) => {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const goBack = () => {
      router.push('/chats');
    };

    const deleteChat = async () => {
      Telegram.WebApp.showConfirm('Вы уверены, что хотите удалить чат?', async (confirmed) => {
        if (confirmed) {
          try {
            await axios.delete(`${BASE_URL}/api/chat/${jobId.value}_${targetUserId.value}`, {
              headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
            });
            isChatDeleted.value = true;
            setTimeout(() => router.push('/chats'), 1000);
          } catch (error) {
            Telegram.WebApp.showAlert('Ошибка при удалении чата');
          }
        }
      });
    };

    const reportChat = () => {
      Telegram.WebApp.showConfirm('Отправить жалобу на этот чат?', async (confirmed) => {
        if (confirmed) {
          try {
            await axios.post(
              `${BASE_URL}/api/report`,
              { jobId: jobId.value, targetUserId: targetUserId.value },
              { headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData } }
            );
            isBlocked.value = true;
          } catch (error) {
            Telegram.WebApp.showAlert('Ошибка при отправке жалобы');
          }
        }
      });
    };

    const checkChatStatus = async () => {
      if (isChatDeleted.value) return;
      if (currentUserId.value === targetUserId.value) {
        isChatDeleted.value = true;
        return;
      }
      try {
        const chatId = `${jobId.value}_${currentUserId.value}_${targetUserId.value}`;
        const blockCheck = await axios.get(`${BASE_URL}/api/chat/status/${chatId}`, {
          headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData },
        });
        isBlocked.value = blockCheck.data.blocked;
      } catch (error) {
        if (error.response?.status === 400 || error.response?.status === 404) {
          isChatDeleted.value = true;
        }
      }
    };

    const handleInputFocus = () => {
      setTimeout(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
        }
      }, 300);
    };

    const handleInputBlur = () => {};

    const handleResize = () => {
      scrollToBottom();
    };

    onMounted(() => {
      if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        currentUserId.value = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
      } else {
        Telegram.WebApp.showAlert('Please open the app via Telegram.');
        return;
      }
      if (!validateParams()) return;

      if (Telegram.WebApp.setHeaderColor) {
        Telegram.WebApp.setHeaderColor('#97f492');
      }
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      fetchUserDetails();
      fetchJobDetails();
      fetchMessages();
      checkChatStatus();
      messageInput.value.addEventListener('focus', handleInputFocus);
      messageInput.value.addEventListener('blur', handleInputBlur);
      window.addEventListener('resize', handleResize);

      const pollInterval = setInterval(() => {
        if (!isChatDeleted.value) {
          fetchMessages();
          checkChatStatus();
        }
      }, 5000);
      onUnmounted(() => clearInterval(pollInterval));
    });

    onUnmounted(() => {
      messageInput.value.removeEventListener('focus', handleInputFocus);
      messageInput.value.removeEventListener('blur', handleInputBlur);
      window.removeEventListener('resize', handleResize);
    });

    return {
      jobId,
      targetUserId,
      currentUserId,
      messages,
      newMessage,
      messagesContainer,
      messageInput,
      targetUserDetails,
      jobDetails,
      isChatDeleted,
      isBlocked,
      fetchMessages,
      sendMessage,
      formatTime,
      goBack,
      deleteChat,
      reportChat,
      checkChatStatus,
    };
  },
};
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f0f0f0;
  font-family: Arial, sans-serif;
}

.chat-header {
  display: flex;
  align-items: center;
  padding: 10px;
  background-color: #97f492;
  color: #000;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.back-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #000;
}

.chat-title {
  flex-grow: 1;
  text-align: left;
  padding-left: 10px;
}

.chat-title span {
  display: block;
}

.job-title {
  font-size: 14px;
  color: #555;
}

.chat-actions {
  display: flex;
  gap: 10px;
}

.report-button,
.delete-button {
  background-color: #ff4444;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
}

.messages-container {
  flex-grow: 1;
  padding: 70px 10px 60px;
  overflow-y: auto;
}

.message {
  display: flex;
  flex-direction: column;
  margin: 5px 0;
  padding: 10px;
  border-radius: 10px;
  max-width: 70%;
}

.sent {
  align-self: flex-end;
  background-color: #97f492;
  color: #000;
}

.received {
  align-self: flex-start;
  background-color: #fff;
  color: #000;
}

.message-text {
  word-wrap: break-word;
}

.message-time {
  font-size: 12px;
  color: #666;
  align-self: flex-end;
}

.input-container {
  display: flex;
  padding: 10px;
  background-color: #fff;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  border-top: 1px solid #ddd;
}

textarea {
  flex-grow: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  resize: none;
  overflow-y: auto;
  max-height: 100px;
}

.send-button {
  margin-left: 10px;
  padding: 10px 20px;
  background-color: #97f492;
  color: #000;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.chat-overlay,
.chat-deleted-overlay {
  position: fixed;
  top: 50px;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.overlay-text {
  color: white;
  font-size: 18px;
  text-align: center;
  padding: 20px;
  background-color: #333;
  border-radius: 10px;
}
</style>