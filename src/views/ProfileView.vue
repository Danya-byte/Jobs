<template>
<div class="profile-container">
    <div class="static-header">
        <RouterLink to="/" class="back-btn">
            <img src="https://i.postimg.cc/PxR6j6Rc/BFF14-B15-FF7-A-41-A2-A7-AB-AC75-B7-DE5-FD7.png" alt="Back">
        </RouterLink>

        <img
            :src="userPhoto || 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp'"
            class="profile-avatar"
            :class="{'avatar-visible': loaded}"
        >
    </div>

    <div class="profile-scroll-content">
        <h1 class="profile-name">{{ userFirstName }}</h1>
    </div>
</div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const loaded = ref(false);
const userPhoto = ref('');
const username = ref('');
const userFirstName = ref('');

onMounted(() => {
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
        Telegram.WebApp.disableVerticalSwipes();
    }

    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const user = Telegram.WebApp.initDataUnsafe.user;
        userPhoto.value = user.photo_url;
        username.value = user.username || 'None';
        userFirstName.value = user.first_name || '';
    }
});

const startAnimation = () => {
    loaded.value = true;
};
</script>

<style scoped>
.profile-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.static-header {
    padding: 20px;
    background: linear-gradient(-45deg, #101622, #182038);
    position: sticky;
    top: 0;
    z-index: 100;
    text-align: center;
}

.profile-avatar {
    width: 100px;
    height: 100px;
    margin-top: 10px;
    border-radius: 50%;
    border: 3px solid transparent;
    box-shadow: 0 0 30px rgba(151, 244, 146, 0.3);
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    animation: border-rotate 3s infinite linear;
}

@keyframes border-rotate {
    0% {
        border-color: #97f492;
        filter: hue-rotate(0deg);
    }
    100% {
        border-color: #97f492;
        filter: hue-rotate(360deg);
    }
}

.avatar-visible {
    opacity: 1;
    transform: translateY(0);
}

.profile-scroll-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    padding-top: 0;
}

.profile-name {
    margin-top: 0;
    padding: 20px 0;
    position: sticky;
    top: 0;
    background: linear-gradient(-45deg, #101622, #182038);
    color: #fff;
    font-size: 28px;
    text-shadow: 0 4px 10px rgba(151, 244, 146, 0.2);
}

.back-btn img {
    width: 25px;
    height: 25px;
    position: absolute;
    left: 20px;
    top: 20px;
    filter: invert(1);
    transition: transform 0.3s ease;
}

.back-btn:hover img {
    transform: translateX(-5px);
}
</style>