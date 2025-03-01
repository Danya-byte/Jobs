<template>
<div class="container">
    <nav class="nav-bar">
        <RouterLink to="/profile">
            <img
                :src="userPhoto || 'https://i.postimg.cc/FK8K0bcd/IMG-1157.png'"
                class="profile-icon"
            >
        </RouterLink>
        <a href="https://t.me/workiks_admin" class="add-button">
            <span>+</span> Add Jobs
        </a>
    </nav>

    <div class="content">
        <div class="categories">
            <button class="category-btn active">Jobs</button>
            <RouterLink to="#">
                <button class="category-btn">Gift</button>
            </RouterLink>
        </div>

        <div class="jobs-list">
            <button
                @click="open = true"
                class="job-card"
                v-for="(job, index) in jobs"
                :key="index"
            >
                <div class="card-header">
                    <img class="job-icon" src="https://i.postimg.cc/FK8K0bcd/IMG-1157.png">
                    <div class="job-info">
                        <p class="nick">{{ job.nick }}</p>
                        <p class="work">{{ job.position }}</p>
                    </div>
                </div>
                <p class="job-description">{{ job.description }}</p>
                <div class="tags">
                    <span v-for="(tag, i) in job.tags" :key="i" class="tag">{{ tag }}</span>
                </div>
            </button>
        </div>
    </div>

    <transition name="fade">
        <div v-if="open" class="modal-overlay" @click.self="open = false">
            <div class="modal">
            </div>
        </div>
    </transition>
</div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const open = ref(false);
const userPhoto = ref('');

onMounted(() => {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const user = Telegram.WebApp.initDataUnsafe.user;
        userPhoto.value = user.photo_url;
    }
});

const jobs = ref([
    {
        nick: "Matvey",
        position: "Frontend Developer",
        description: "Разработка Telegram Mini App по ТЗ",
        tags: ["JavaScript", "Rust"]
    }
]);
</script>

<style scoped>
.container {
    background: linear-gradient(45deg, #101622, #1a2233);
    min-height: 100vh;
    padding: 20px;
}

.nav-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
}

.profile-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid #97f492;
    position: relative;
    overflow: hidden;
    animation: pulse-border 2s infinite;
}

@keyframes pulse-border {
    0% { box-shadow: 0 0 0 0 rgba(151, 244, 146, 0.7); }
    70% { box-shadow: 0 0 0 10px rgba(151, 244, 146, 0); }
    100% { box-shadow: 0 0 0 0 rgba(151, 244, 146, 0); }
}

.add-button {
    background: linear-gradient(135deg, #97f492 0%, #6de06a 100%);
    padding: 12px 25px;
    border-radius: 30px;
    color: #000;
    font-weight: 600;
    box-shadow: 0 4px 15px rgba(151, 244, 146, 0.3);
    transition: 0.3s;
}

.add-button:hover {
    transform: translateY(-2px);
}

.categories {
    display: flex;
    gap: 15px;
    margin-bottom: 30px;
}

.category-btn {
    background: #272e38;
    color: #fff;
    border: none;
    padding: 10px 25px;
    border-radius: 12px;
    cursor: pointer;
    transition: 0.3s;
}

.category-btn.active {
    background: #97f492;
    color: #000;
}

.job-card {
    background: #181e29;
    width: 100%;
    border-radius: 20px;
    padding: 20px;
    margin-bottom: 15px;
    border: 1px solid #2d3540;
    transition: 0.3s;
    text-align: left;
}

.job-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0,0,0,0.2);
}

.job-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
}

.card-header {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 15px;
}

.nick {
    color: #97f492;
    font-size: 14px;
    margin: 0;
}

.work {
    color: #fff;
    font-size: 18px;
    margin: 0;
}

.job-description {
    color: #8a8f98;
    font-size: 14px;
    line-height: 1.5;
}

.tags {
    display: flex;
    gap: 10px;
    margin-top: 15px;
}

.tag {
    background: #2d3540;
    color: #97f492;
    padding: 5px 12px;
    border-radius: 8px;
    font-size: 12px;
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
    display: grid;
    place-items: center;
}

.modal {
    background: #181e29;
    width: 90%;
    max-width: 500px;
    border-radius: 20px;
    padding: 25px;
    position: relative;
}
</style>