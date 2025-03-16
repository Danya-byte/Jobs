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
      path: '/chat/:chatId',
      name: 'chat',
      component: () => import('../views/ChatView.vue'),
      props: (route) => {
        const chatId = route.params.chatId;
        const [jobId, targetUserId] = chatId.split('_');
        return {
          jobId,
          targetUserId,
          chatId,
          username: route.query.username,
        };
      },
      beforeEnter: (to, from, next) => {
        const chatId = to.params.chatId;
        if (!chatId || !chatId.includes('_')) {
          console.warn('Invalid chatId format. Expected: jobId_targetUserId');
          next({ name: 'chatList' });
        } else {
          next();
        }
      },
    },
    {
      path: '/chats',
      name: 'chatList',
      component: () => import('../views/ChatListView.vue'),
    },
  ],
});

export default router;