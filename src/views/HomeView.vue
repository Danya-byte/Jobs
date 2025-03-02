<template>
<div class="container">
    <nav class="nav-bar">
        <RouterLink to="/profile" class="profile-link">
            <img
                :src="userPhoto"
                class="profile-icon"
            >
            <div class="user-name">
                <span class="first-name">{{ userFirstName }}</span>
            </div>
        </RouterLink>
        <a href="https://t.me/workiks_admin" class="add-button">
            Add Jobs
        </a>
    </nav>

    <div class="content">
        <div class="categories">
            <button class="category-btn active">Jobs</button>
            <button class="category-btn">Gift</button>
        </div>

        <div class="jobs-scroll-container">
            <div class="jobs-list">
                <button
                    @click="showJobDetails(job)"
                    class="job-card"
                    v-for="(job, index) in jobs"
                    :key="index"
                >
                    <div class="card-header">
                        <img
                            class="job-icon"
                            :src="job.photoUrl || 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp'"
                        >
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
    </div>

    <div v-if="open" class="modal-overlay" @click.self="open = false">
        <div class="modal">
            <div class="modal-header">
                <h2>{{ selectedJob.position }}</h2>
                <button class="close-btn" @click="open = false">&times;</button>
            </div>

            <div class="job-details">
                <div
                    class="user-info"
                    @click="$router.push({
                        path: `/profile/${selectedJob.userId}`,
                        query: { username: selectedJob.username }
                    })"
                >
                    <img
                        :src="selectedJob.photoUrl || 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp'"
                        class="job-icon"
                    >
                    <div>
                        <p class="nickname">{{ selectedJob.nick }}</p>
                        <p class="experience">{{ selectedJob.experience }}</p>
                    </div>
                </div>

                <div class="section">
                    <h3>Description</h3>
                    <p class="description">{{ selectedJob.description }}</p>
                </div>

                <div class="section">
                    <h3>Requirements</h3>
                    <ul class="requirements">
                        <li v-for="(req, i) in selectedJob.requirements" :key="i">{{ req }}</li>
                    </ul>
                </div>

                <a
                    :href="selectedJob.contact"
                    class="contact-btn"
                    target="_blank"
                >
                    Contact via Telegram
                </a>
            </div>
        </div>
    </div>
</div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const open = ref(false);
const selectedJob = ref({});
const userPhoto = ref('');
const userFirstName = ref('');

const jobs = ref([
    {
        nick: "Matvey",
        userId: 1029594875,
        username: "workiks_admin",
        photoUrl: "https://t.me/i/userpic/160/workiks_admin.jpg",
        position: "Frontend Developer",
        experience: "5 years experience",
        description: "Разработка Telegram Mini App по ТЗ с полным циклом от проектирования до запуска.",
        requirements: [
            "Опыт работы с Vue.js",
            "Знание HTML, CSS, JavaScript",
            "Интеграция с Telegram API"
        ],
        tags: ["JavaScript", "Vue 3", "Telegram API"],
        contact: "https://t.me/workiks_admin"
    },
    {
        nick: "Danone",
        userId: 7079899705,
        username: "Danoneee777",
        photoUrl: "https://t.me/i/userpic/160/Danoneee777.jpg",
        position: "Moderator",
        experience: "3 years experience",
        description: "Модерация сообществ и управление контентом.",
        requirements: [
            "Опыт работы с социальными сетями",
            "Коммуникативные навыки",
            "Знание основ модерации"
        ],
        tags: ["Модерация", "Социальные сети"],
        contact: "https://t.me/Danoneee777"
    }
]);

const showJobDetails = (job) => {
    selectedJob.value = job;
    open.value = true;
};

onMounted(() => {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const user = Telegram.WebApp.initDataUnsafe.user;
        userPhoto.value = user.photo_url || `https://t.me/i/userpic/160/${user.username}.jpg`;
        userFirstName.value = user.first_name || 'User';
    }
});
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

.profile-link {
    display: flex;
    align-items: center;
    gap: 10px;
}

.profile-icon {
    width: 47px;
    height: 47px;
    border-radius: 50%;
    border: 2px solid #97f492;
}

.user-name {
    display: flex;
    flex-direction: column;
}

.first-name {
    font-size: 16px;
    font-weight: 600;
}

.add-button {
    background: linear-gradient(135deg, #97f492 0%, #6de06a 100%);
    padding: 8px 20px;
    border-radius: 30px;
    color: #000;
    font-weight: 400;
}

.categories {
    display: flex;
    gap: 15px;
    margin-bottom: 20px;
}

.category-btn {
    background: #272e38;
    color: #fff;
    border: none;
    padding: 10px 25px;
    border-radius: 12px;
}

.category-btn.active {
    background: #97f492;
    color: #000;
}

.jobs-scroll-container {
    flex-grow: 1;
    overflow-y: auto;
}

.jobs-list {
    display: grid;
    gap: 15px;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}

.job-card {
    background: #181e29;
    padding: 20px;
    border-radius: 20px;
    border: 1px solid #2d3540;
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
}

.nick {
    color: #97f492;
}

.work {
    color: #fff;
}

.tags {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.tag {
    background: #2d3540;
    color: #97f492;
    padding: 5px 12px;
    border-radius: 8px;
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
}

.modal {
    background: #181e29;
    padding: 25px;
    border-radius: 20px 20px 0 0;
}

.contact-btn {
    background: linear-gradient(135deg, #97f492 0%, #6de06a 100%);
    color: #000;
    padding: 15px;
    border-radius: 12px;
}
</style>