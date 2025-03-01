<template>
<div class="nft-container">
</div>
</template>

<style scoped>
.nft-container {
    background: linear-gradient(45deg, #101622, #1a2233);
    padding: 20px;
    min-height: 100vh;
}

.nft-card {
    background: #181e29;
    border-radius: 20px;
    padding: 15px;
    margin: 10px;
    border: 1px solid #2d3540;
    transition: 0.3s;
}

.nft-card:hover {
    transform: scale(1.03);
    box-shadow: 0 8px 25px rgba(151, 244, 146, 0.1);
}

.nft-image {
    width: 100%;
    border-radius: 12px;
    margin-bottom: 10px;
}

.buy-button {
    background: linear-gradient(135deg, #97f492 0%, #6de06a 100%);
    width: 100%;
    padding: 12px;
    border-radius: 12px;
    color: #000;
    font-weight: 600;
    margin-top: 10px;
}
</style>