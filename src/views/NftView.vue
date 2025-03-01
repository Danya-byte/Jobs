<template>
<div class="nft-container">
    <div
        class="nft"
        style="transform: translateZ(0)"
        @mouseenter="hoverNFT = true"
        @mouseleave="hoverNFT = false"
        :style="{
            transform: hoverNFT ? 'rotate3d(1, 2, 1, 5deg) scale(1.05)' : 'none'
        }"
    >
        <img
            src="https://media0.giphy.com/media/qrII0WLKNJLltYiv6R/giphy.gif"
            class="nft-image"
            alt="NFT"
        >
        <p class="infonft">Eternal Candle</p>
        <p class="numbergift">#24216</p>
        <button @click="open1 = true" class="buygift">0.75 TON</button>
    </div>

    <div v-if="open1" class="modal">
        <button @click="open1 = false" class="close-btn">&times;</button>
    </div>
</div>
</template>

<script setup>
import { ref } from 'vue';

const open1 = ref(false);
const hoverNFT = ref(false);
</script>

<style scoped>
.nft {
    backface-visibility: hidden;
    will-change: transform;
}
</style>