<template>
  <div class="chat-container">
    <div class="chat-header">
      <h2>Chat with {{ nick || 'Unknown' }}</h2>
      <button class="close-btn" @click="$router.push('/')">×</button>
    </div>
    <div class="chat-messages" v-if="chatUnlocked">
      <div v-for="(message, index) in messages" :key="index" :class="['message', message.isSender ? 'sent' : 'received']">
        <p>{{ message.text }}</p>
        <span class="timestamp">{{ new Date(message.timestamp).toLocaleTimeString() }}</span>
      </div>
    </div>
    <div class="chat-locked" v-else>
      <p>Pay 1 XTR to unlock chat with this freelancer.</p>
      <button class="pay-btn" @click="requestPayment">Unlock Chat (1 XTR)</button>
    </div>
    <div class="chat-input" v-if="chatUnlocked">
      <input v-model="newMessage" placeholder="Type your message..." @keyup.enter="sendMessage" class="message-input">
      <button @click="sendMessage" class="send-btn">Send</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const router = useRouter();
const userId = ref(route.params.userId);
const jobId = ref(route.query.jobId);
const BASE_URL = 'https://impotently-dutiful-hare.cloudpub.ru';

const chatUnlocked = ref(false);
const messages = ref([]);
const newMessage = ref('');
const nick = ref('Unknown');

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

const requestPayment = async () => {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/createChatInvoice`,
      { targetUserId: userId.value, jobId: jobId.value },
      { headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData } }
    );
    if (response.data.success) {
      window.Telegram.WebApp.openInvoice(response.data.invoiceLink, (status) => {
        if (status === 'paid') {
          chatUnlocked.value = true;
          Telegram.WebApp.showAlert('Chat unlocked successfully!');
          fetchMessages();
        } else if (status === 'cancelled') {
          Telegram.WebApp.showAlert('Payment cancelled.');
        }
      });
    }
  } catch (error) {
    console.error('Error requesting payment:', error);
    Telegram.WebApp.showAlert('Failed to initiate payment.');
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

onMounted(() => {
  if (window.Telegram?.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
  }
  fetchJobDetails();
  checkChatStatus();
});

const checkChatStatus = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/chat/status/${userId.value}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    chatUnlocked.value = response.data.unlocked;
    if (chatUnlocked.value) fetchMessages();
  } catch (error) {
    console.error('Error checking chat status:', error);
  }
};
</script>

<style scoped>
.chat-container {
  background: linear-gradient(45deg, #101622, #1a2233);
  min-height: 100vh;
  padding: 10px;
  display: flex;
  flex-direction: column;
}
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.chat-header h2 {
  color: #97f492;
  margin: 0;
  font-size: 18px;
}
.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 28px;
  cursor: pointer;
}
.chat-messages {
  flex-grow: 1;
  overflow-y: auto;
  padding: 5px;
  background: #181e29;
  border-radius: 8px;
}
.message {
  margin: 5px 0;
  padding: 5px 8px;
  border-radius: 8px;
  max-width: 40%;
  font-size: 15px;
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
  font-size: 8px;
  color: #8a8f98;
  display: block;
  margin-top: 2px;
}
.chat-locked {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #fff;
  font-size: 12px;
}
.pay-btn {
  background: linear-gradient(135deg, #97f492 0%, #6de06a 100%);
  color: #000;
  padding: 5px 10px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 10px;
  font-size: 12px;
}
.chat-input {
  display: flex;
  gap: 5px;
  margin-top: 3px;
}
.message-input {
  flex-grow: 1;
  padding: 10px;
  border-radius: 12px;
  border: none;
  background: #272e38;
  color: #fff;
  font-size: 18px;
}
.send-btn {
  background: #97f492;
  color: #000;
  padding: 5px 10px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
}
</style>