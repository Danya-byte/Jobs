<template>
<div class="container">
    <nav class="nav-bar">
        <RouterLink to="/profile">
            <img
                src="https://i.postimg.cc/FK8K0bcd/IMG-1157.png"
                class="profile-icon"
                style="transform: translateZ(0)"
            >
        </RouterLink>
        <a href="https://t.me/workiks_admin" class="add-button">
            <span>+</span> Add Job
        </a>
    </nav>

    <div class="categories-wrapper">
        <h1 class="page-title">Jobs</h1>
        <div class="categories">
            <button class="category-btn active">All</button>
            <RouterLink to="/nft">
                <button class="category-btn">Gift</button>
            </RouterLink>
        </div>
    </div>

    <transition-group name="list" tag="div">
        <button
            @click="open = true"
            class="job-card"
            key="job1"
            style="transform: translateZ(0)"
            @mouseenter="hoverCard = true"
            @mouseleave="hoverCard = false"
            :class="{'hover-card': hoverCard}"
        >
            <div>
                <img class="img" src="https://i.postimg.cc/FK8K0bcd/IMG-1157.png">
                <p class="nick">Whsxg</p>
                <p class="work">Frontend Developer</p>
                <p class="info">Разработка Telegram Mini App</p>
            </div>
            <div class="lang-wrapper">
                <div class="lang">JavaScript</div>
                <div class="lang">Rust</div>
            </div>
        </button>
    </transition-group>

    <transition name="modal">
        <div v-if="open" class="modal-overlay">
            <div class="modal-content">
                <button @click="open = false" class="close-btn">&times;</button>
            </div>
        </div>
    </transition>
</div>
</template>

<script setup>
import { ref } from 'vue';

const open = ref(false);
const hoverCard = ref(false);
</script>

<style scoped>
.profile-icon, .add-button, .category-btn, .job-card {
    transform: translateZ(0);
    backface-visibility: hidden;
    will-change: transform, opacity;
}

.job-card:hover {
    transform: perspective(1000px) rotateX(3deg) translateY(-5px) !important;
}
</style>