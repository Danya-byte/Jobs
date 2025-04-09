<template>
  <div class="main-container">
    <div class="particles">
      <div v-for="i in 30" :key="i" class="particle"></div>
    </div>

    <div class="content">
      <div class="icon-container">
        <svg class="gear" viewBox="0 0 100 100">
          <path d="M79.9 52.6C80.6 54 80.8 55.5 80.7 57 85 57 88.5 60.6 88.5 65 88.5 69.4 85 73 80.7 73 80.7 74.5 80.5 76 79.8 77.4 82.6 79.3 84.8 82 86.3 85.1 89.7 84.1 92.5 87.1 92.5 90.8 92.5 94.9 89.2 98.2 85.1 98.2 82.7 98.2 80.6 96.8 79.4 94.6 76.8 96.6 73.7 98 70.3 98.5L70.3 92.3C73.1 91.7 75.6 90.2 77.5 88.1 75.8 86.6 73.6 85.6 71.3 85.2L71.3 79.1C73.6 79.5 75.8 80.5 77.5 82 79.4 79.9 81.9 78.4 84.7 77.8L84.7 71.6C81.3 72.1 78.2 73.9 75.8 76.4 74.6 74.2 72.5 72.8 70.1 72.8 66 72.8 62.6 76.2 62.6 80.3 62.6 82.7 63.9 84.8 65.7 86.1 63.2 88.5 60.3 90.2 57 90.8L57 84.6C60.3 84 63.2 82.3 65.7 80 67.5 81.3 69.6 82.6 72 82.6 76.1 82.6 79.5 79.2 79.5 75.1 79.5 73.1 78.6 71.3 77.2 70L79.9 52.6ZM50 65.6C57.3 65.6 63.3 59.6 63.3 52.3 63.3 45 57.3 39 50 39 42.7 39 36.7 45 36.7 52.3 36.7 59.6 42.7 65.6 50 65.6Z" fill="#fff"/>
        </svg>
      </div>

      <h1 class="title animate__animated animate__fadeInDown">
        Ведутся технические работы
      </h1>

      <p class="description animate__animated animate__fadeInUp animate__delay-1s">
        Мы улучшаем наш сервис для вас! Приносим извинения за временные неудобства.
      </p>

      <div class="progress animate__animated animate__fadeInUp animate__delay-2s">
        <div class="progress-bar"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const targetTime = ref(Date.now() + 2 * 60 * 60 * 1000) // +2 часа

const timeLeft = ref(0)

const updateTimer = () => {
  const now = Date.now()
  timeLeft.value = targetTime.value - now
  if(timeLeft.value > 0) {
    requestAnimationFrame(updateTimer)
  }
}

const back = () => {
  window.Telegram.WebApp.BackButton.hide();
  window.location.href = '/';
};

onMounted(() => {
  Telegram.WebApp.setHeaderColor('#97f492');
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
  updateTimer()
})

const hours = computed(() => Math.floor((timeLeft.value / (1000 * 60 * 60)) % 24).toString().padStart(2, '0'))
const minutes = computed(() => Math.floor((timeLeft.value / (1000 * 60)) % 60).toString().padStart(2, '0'))
const seconds = computed(() => Math.floor((timeLeft.value / 1000) % 60).toString().padStart(2, '0'))
</script>

<style scoped>
.main-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.particles {
  position: absolute;
  width: 100%;
  height: 100%;
}

.particle {
  position: absolute;
  background: rgba(255,255,255,0.3);
  border-radius: 50%;
  animation: float 15s infinite linear;
}

@keyframes float {
  0% { transform: translateY(0) translateX(0); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: translateY(-100vh) translateX(100vw); opacity: 0; }
}

.content {
  text-align: center;
  z-index: 1;
  padding: 2rem;
}

.icon-container {
  margin-bottom: 2rem;
}

.gear {
  width: 150px;
  height: 150px;
  animation: rotate 8s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.title {
  font-size: 3rem;
  margin-bottom: 1.5rem;
  text-shadow: 0 0 15px rgba(255,255,255,0.5);
}

.description {
  font-size: 1.2rem;
  margin-bottom: 3rem;
  opacity: 0.9;
}

.progress {
  width: 300px;
  height: 4px;
  background: rgba(255,255,255,0.2);
  margin: 2rem auto;
  border-radius: 2px;
}

.progress-bar {
  width: 60%;
  height: 100%;
  background: linear-gradient(90deg, #e94560, #ff6b6b);
  border-radius: 2px;
  animation: progress 2s ease-in-out infinite alternate;
}

@keyframes progress {
  from { width: 50%; }
  to { width: 70%; }
}

.timer {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-top: 3rem;
}

.time-block {
  background: rgba(255,255,255,0.1);
  padding: 1rem 2rem;
  border-radius: 10px;
  backdrop-filter: blur(5px);
  transition: transform 0.3s ease;
}

.time-block:hover {
  transform: translateY(-5px);
}

.time {
  font-size: 2.5rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.label {
  font-size: 0.9rem;
  opacity: 0.8;
}

@media (max-width: 768px) {
  .title {
    font-size: 2rem;
  }

  .timer {
    flex-direction: column;
  }
}
</style>