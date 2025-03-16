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
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
    },
    {
      path: '/profile/:userId',
      name: 'profileWithId',
      component: () => import('../views/ProfileView.vue'),
      props: (route) => ({
        userId: route.params.userId,
        username: route.query.username,
      }),
    },
    {
      path: '/nft',
      name: 'nft',
      component: () => import('../views/NftView.vue'),
    },
    {
      path: '/chat/:targetUserId', // Изменено с :userId на :targetUserId
      name: 'chat',
      component: () => import('../views/ChatView.vue'),
      props: (route) => ({
        targetUserId: route.params.targetUserId, // Изменено с userId на targetUserId
        username: route.query.username,
        jobId: route.query.jobId,
      }),
    },
    {
      path: '/chats',
      name: 'chatList',
      component: () => import('../views/ChatListView.vue'),
    },
  ],
});

export default router;