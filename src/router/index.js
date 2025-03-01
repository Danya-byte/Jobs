import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/profile/:userId?', // Добавлен параметр userId
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
    },
    {
      path: '/nft',
      name: 'nft',
      component: () => import('../views/NftView.vue'),
    },
  ],
});

export default router;