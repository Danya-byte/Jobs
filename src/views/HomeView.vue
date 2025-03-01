<template>
<div class="container">
    <nav class="nav-bar">
        <RouterLink to="/profile" class="profile-link">
            <img
                :src="userPhoto || 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp'"
                class="profile-icon"
            >
            <div class="user-name" v-if="userFirstName || userLastName">
                <span class="first-name">{{ userFirstName }}</span>
            </div>
        </RouterLink>
        <a href="https://t.me/workiks_admin" class="add-button">
            <span></span> Add Jobs
        </a>
    </nav>

    <div class="content">
        <div class="categories">
            <button class="category-btn active">Jobs</button>
            <RouterLink to="#">
                <button class="category-btn">Gift</button>
            </RouterLink>
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
                        <img class="job-icon" src="https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp">
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

    <transition name="slide-up">
        <div v-if="open" class="modal-overlay" @click.self="open = false">
            <div class="modal">
                <div class="modal-header">
                    <h2>{{ selectedJob.position }}</h2>
                    <button class="close-btn" @click="open = false">&times;</button>
                </div>

                <div class="job-details">
                    <div class="user-info" @click="$router.push(selectedJob.profileLink)">
                        <img :src="jobIcon" class="job-icon">
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

                    <div class="section">
                        <h3>Skills</h3>
                        <div class="tags">
                            <span v-for="(tag, i) in selectedJob.tags" :key="i" class="tag">{{ tag }}</span>
                        </div>
                    </div>

                    <a
                        :href="selectedJob.contact || 'https://t.me/workiks_admin'"
                        class="contact-btn"
                        target="_blank"
                    >
                        Contact via Telegram
                    </a>
                </div>
            </div>
        </div>
    </transition>
</div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const open = ref(false);
const selectedJob = ref({});
const userPhoto = ref('');
const userFirstName = ref('');
const userLastName = ref('');
const jobIcon = 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp';

const jobs = ref([
    {
        nick: "Matvey",
        position: "Vrotend Developer",
        profileLink: '/profile/Matvey',
        experience: "5 years experience",
        description: "Разработка Telegram Mini App по ТЗ с полным циклом от проектирования до запуска(я вас скамну и сольюсь)",
        requirements: [
            "Опыт работы с Vue.js 1 час",
            "Знание HTML на школьном уровне",
            "Имею опыт интеграции с Telegram API(на самом деле - нет)"
        ],
        tags: ["JavaScript", "Vue 3", "Toxic", "School"],
        contact: "https://t.me/workiks_admin"
    },
    {
        nick: "Danone",
        position: "Moderator",
        profileLink: '/profile/Matvey',
        experience: "5 years ebli",
        description: "Я ничего не умею,сосу хуй с Deleted у Raven-а,ну в принципе и всё,а еще могу повыебываться",
        requirements: [
            "Опыт работы с Raven 10 лет",
            "Знание Iznanki на все 100%",
            "Имею опыт сосать хуй у обоих сразу(такое никто не может делать)"
        ],
        tags: ["ДИНАХУ", "ДИНАХУ", "ДИНАХУ", "ДУДКУ", "ДУДКУ", "ДУДКУ"],
        contact: "https://t.me/Danoneee777"
    }
]);

const showJobDetails = (job) => {
    selectedJob.value = job;
    open.value = true;
};

onMounted(() => {
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
        Telegram.WebApp.disableVerticalSwipes();
    }

    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const user = Telegram.WebApp.initDataUnsafe.user;
        userPhoto.value = user.photo_url || '';
        userFirstName.value = user.first_name || '';
        userLastName.value = user.last_name || '';
    }
});
</script>

<style scoped>
.container {
    background: linear-gradient(45deg, #101622, #1a2233);
    min-height: 100vh;
    padding: 20px;
    overflow: hidden;
    position: relative;
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
    text-decoration: none;
}

.profile-icon {
    width: 47px;
    height: 47px;
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

.user-name {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

@keyframes fade-in {
    from { opacity: 0; transform: translateX(-10px); }
    to { opacity: 1; transform: translateX(0); }
}

@keyframes color-change {
    0% { color: #97f492; }
    25% { color: #6de06a; }
    50% { color: #4acf8e; }
    75% { color: #3bb3b3; }
    100% { color: #97f492; }
}

.first-name, .last-name {
    font-size: 16px;
    font-weight: 600;
    animation: fade-in 0.5s ease-in-out, color-change 5s infinite;
}

.add-button {
    background: linear-gradient(135deg, #97f492 0%, #6de06a 100%);
    padding: 8px 20px;
    border-radius: 30px;
    color: #000;
    font-weight: 400;
    box-shadow: 0 4px 15px rgba(151, 244, 146, 0.3);
    transition: 0.3s;
    font-size: 14px;
    text-decoration: none;
    animation: pulse 2s infinite;
}

.add-button:hover {
    transform: translateY(-2px);
}

.categories {
    display: flex;
    gap: 15px;
    margin-bottom: 20px;
    flex-shrink: 0;
}

.category-btn {
    background: #272e38;
    color: #fff;
    border: none;
    padding: 10px 25px;
    border-radius: 12px;
    cursor: pointer;
    transition: 0.3s;
    font-size: 14px;
    font-weight: 600;
}

.category-btn.active {
    background: #97f492;
    color: #000;
    animation: pulse 2s infinite;
}

.content {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 100px);
}

.jobs-scroll-container {
    flex-grow: 1;
    overflow-y: auto;
    padding-right: 20px;
    margin-right: -30px;
}

.jobs-list {
    display: grid;
    gap: 15px;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    padding-bottom: 20px;
}

.job-card {
    background: #181e29;
    width: auto;
    min-width: 300px;
    border-radius: 20px;
    padding: 20px;
    border: 1px solid #2d3540;
    transition: 0.3s;
    text-align: left;
    box-sizing: border-box;
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
    flex-wrap: wrap;
    max-width: 100%;
}

.tag {
    background: #2d3540;
    color: #97f492;
    padding: 5px 12px;
    border-radius: 8px;
    font-size: 12px;
    white-space: nowrap;
    flex-shrink: 0;
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: flex-end;
}

.modal {
    background: #181e29;
    width: 100%;
    border-radius: 20px 20px 0 0;
    padding: 25px;
    max-height: 90vh;
    overflow-y: auto;
    transform: translateY(100%);
    animation: slide-up 0.3s ease-out forwards;
    padding-right: 20px;
    margin-right: -40px;
}

@keyframes slide-up {
    to {
        transform: translateY(0);
    }
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
}

.modal-header h2 {
    color: #97f492;
    margin: 0;
}

.close-btn {
    background: none;
    border: none;
    color: #fff;
    font-size: 28px;
    cursor: pointer;
    padding: 0 10px;
}

.job-details {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.user-info {
    display: flex;
    align-items: center;
    gap: 15px;
}

.nickname {
    color: #97f492;
    margin: 0;
    font-size: 18px;
}

.experience {
    color: #8a8f98;
    margin: 0;
    font-size: 14px;
}

.section h3 {
    color: #fff;
    margin: 0 0 10px 0;
    font-size: 16px;
}

.description {
    color: #c2c6cf;
    line-height: 1.5;
    margin: 0;
}

.requirements {
    padding-left: 20px;
    margin: 0;
    color: #c2c6cf;
}

.requirements li {
    margin-bottom: 8px;
}

.contact-btn {
    background: linear-gradient(135deg, #97f492 0%, #6de06a 100%);
    color: #000;
    text-align: center;
    padding: 15px;
    border-radius: 12px;
    text-decoration: none;
    font-weight: 600;
    margin-top: 20px;
    transition: transform 0.2s;
}

.contact-btn:hover {
    transform: translateY(-2px);
}

.slide-up-enter-active,
.slide-up-leave-active {
    transition: opacity 0.3s, transform 0.3s;
}

.slide-up-enter-from,
.slide-up-leave-to {
    opacity: 0;
    transform: translateY(100%);
}

@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}
</style>