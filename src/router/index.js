import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
    },
    {
      path: '/profile/:userId',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      props: (route) => ({
        userId: route.params.userId,
        username: route.query.username
      })
    },
    {
      path: '/nft',
      name: 'nft',
      component: () => import('../views/NftView.vue'),
    },
  ],
})

export default router