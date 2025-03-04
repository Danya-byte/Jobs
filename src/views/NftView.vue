<template>
<body>
<div>
<a style="text-decoration: none; color: black;" href="https://t.me/workiks_admin">
    <button class="add" style="text-decoration: none; color: black;">Add</button>
</a>
</div>

<div>
    <h1>Jobs:</h1>
    <div>
    <RouterLink to="/">
        <button class="categories">All</button>
    </RouterLink>
    <RouterLink to="/nft">
        <button class="categories" style="background-color: #97f492; color: black;">Gift</button>
    </RouterLink>
    </div>
</div>

<div style="display: flex">
<div class="nft">
    <img src="https://media0.giphy.com/media/qrII0WLKNJLltYiv6R/giphy.gif?cid=9b38fe9157pu88qaq4jqvcfoy2oo170yml9b2z3jbj584zax&ep=v1_gifs_username&rid=giphy.gif&ct=g" width="150px" style="margin-left: 10px; border-radius: 10px; margin-top: 8px;">
    <p class="infonft">Eternal Candle</p>
    <p class="numbergift">#24216</p>
    <button @click="open1 = true" class="buygift" style="text-decoration: none; color: black;">0.75 TON</button>
</div>

<div v-if="open1" class="modal">
<div style="justify-content: center; align-items: center; text-align: center;">
    <img src="https://media0.giphy.com/media/qrII0WLKNJLltYiv6R/giphy.gif?cid=9b38fe9157pu88qaq4jqvcfoy2oo170yml9b2z3jbj584zax&ep=v1_gifs_username&rid=giphy.gif&ct=g" width="200px" style="border-radius: 10px; margin-top: 50px;">
    <h3 class="giftinfmodal">Eternal Candle<br>#24216</h3>
</div>
<div class="infogift" style="margin-left: 20px; margin-top: 50px;">
    <p>Model:</p>
    <p style="float: right; margin-top: -35px; margin-right: 20px;">Silver Spark(1,5%)</p>
    <p>Symbol:</p>
    <p style="float: right; margin-top: -35px; margin-right: 20px;">Sky Blue(2%)</p>
    <p>Pattern:</p>
    <p style="float: right; margin-top: -35px; margin-right: 20px;">Candle(1,8%)</p>
</div>
<a href="https://t.me/workiks_admin">
    <button class="contact" style="margin-left: 20px; text-decoration: none; color: black;"><b>Contact</b></button>
</a>
    <button @click="open1 = false" class="close" style="margin-left: 400px; margin-top: -465px;">X</button>
</div>


</div>
</body>
</template>

<script setup>
import { ref } from 'vue'

const open = ref(false)
const open1 = ref(false)
const open2 = ref(false)
</script>