<template>
<div class="profile-container">
    <RouterLink to="/" class="back-btn">
        <img src="https://i.postimg.cc/PxR6j6Rc/BFF14-B15-FF7-A-41-A2-A7-AB-AC75-B7-DE5-FD7.png" alt="Back">
    </RouterLink>

    <div class="profile-content">
        <img
            :src="userPhoto || 'https://i.postimg.cc/3RcrzSdP/2d29f4d64bf746a8c6e55370c9a224c0.webp'"
            class="profile-avatar"
            @load="startAnimation"
            :class="{'avatar-visible': loaded}"
        >
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
        userLastName.value = user.last_name || '';
    }
});

const startAnimation = () => {
    loaded.value = true;
};
</script>

<style scoped>
.profile-container {
    background: linear-gradient(-45deg, #101622, #182038);
    min-height: 100vh;
    padding: 30px 20px;
    overflow: hidden;
}

.back-btn img {
    width: 30px;
    height: 30px;
    filter: invert(1);
    transition: transform 0.3s ease;
}

.back-btn:hover img {
    transform: translateX(-5px);
}

.profile-content {
    text-align: center;
    margin-top: 50px;
}

.profile-avatar {
    width: 100px;
    height: 100px;
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

.profile-name {
    color: #fff;
    font-size: 28px;
    margin-top: 25px;
    text-shadow: 0 4px 10px rgba(151, 244, 146, 0.2);
}
</style>