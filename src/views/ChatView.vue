<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const router = useRouter();
const userId = ref(route.params.userId);
const nick = ref(route.query.nick); // Ник уже берется из query
const jobId = ref(route.query.jobId);
const BASE_URL = 'https://impotently-dutiful-hare.cloudpub.ru';

const chatUnlocked = ref(true); // Оставляем для совместимости, но теперь это не главное условие
const messages = ref([]);
const newMessage = ref('');

const requestPaymentForMessage = async () => {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/createMessageInvoice`, // Новый эндпоинт для оплаты сообщения
      { targetUserId: userId.value, jobId: jobId.value },
      { headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData } }
    );
    if (response.data.success) {
      return new Promise((resolve) => {
        window.Telegram.WebApp.openInvoice(response.data.invoiceLink, (status) => {
          if (status === 'paid') {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      });
    }
  } catch (error) {
    console.error('Error requesting payment for message:', error);
    Telegram.WebApp.showAlert('Failed to initiate payment.');
    return false;
  }
};

const fetchMessages = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/chat/${userId.value}`, {
      headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData }
    });
    messages.value = response.data.messages;
  } catch (error) {
    console.error('Error fetching messages:', error);
  }
};

const sendMessage = async () => {
  if (!newMessage.value.trim()) return;

  // Запрашиваем оплату перед отправкой сообщения
  const paymentSuccessful = await requestPaymentForMessage();
  if (!paymentSuccessful) {
    Telegram.WebApp.showAlert('Payment required to send a message.');
    return;
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/api/chat/${userId.value}`,
      { text: newMessage.value },
      { headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData } }
    );
    messages.value.push(response.data.message);
    await notifyFreelancer();
    newMessage.value = '';
    Telegram.WebApp.showAlert('Message sent successfully!');
  } catch (error) {
    console.error('Error sending message:', error);
    Telegram.WebApp.showAlert('Failed to send message.');
  }
};

const notifyFreelancer = async () => {
  try {
    await axios.post(
      `${BASE_URL}/api/notifyFreelancer`,
      { targetUserId: userId.value, text: newMessage.value },
      { headers: { 'X-Telegram-Data': window.Telegram.WebApp.initData } }
    );
  } catch (error) {
    console.error('Error notifying freelancer:', error);
  }
};

onMounted(() => {
  if (window.Telegram?.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
  }
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
/* Стили остаются без изменений */
.chat-container {
  background: linear-gradient(45deg, #101622, #1a2233);
  min-height: 100vh;
  padding: 20px;
  display: flex;
  flex-direction: column;
}
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.chat-header h2 {
  color: #97f492;
  margin: 0;
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
  padding: 10px;
  background: #181e29;
  border-radius: 12px;
}
.message {
  margin: 10px 0;
  padding: 10px 15px;
  border-radius: 12px;
  max-width: 70%;
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
  font-size: 12px;
  color: #8a8f98;
  display: block;
  margin-top: 5px;
}
.chat-locked {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #fff;
}
.pay-btn {
  background: linear-gradient(135deg, #97f492 0%, #6de06a 100%);
  color: #000;
  padding: 10px 20px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  margin-top: 20px;
}
.chat-input {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
.message-input {
  flex-grow: 1;
  padding: 10px;
  border-radius: 12px;
  border: none;
  background: #272e38;
  color: #fff;
}
.send-btn {
  background: #97f492;
  color: #000;
  padding: 10px 20px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
}
</style>