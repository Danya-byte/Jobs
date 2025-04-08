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
      path: '/profile/:userId?',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      props: (route) => ({
        userId: route.params.userId || null,
        username: route.query.username || 'unknown',
      }),
    },
    {
      path: '/nft',
      name: 'nft',
      component: () => import('../views/NftView.vue'),
    },
    {
      path: '/chat/:chatUuid',
      name: 'chat',
      component: () => import('../views/ChatView.vue'),
      props: (route) => ({
        chatUuid: route.params.chatUuid,
        username: route.query.username,
      }),
      beforeEnter: async (to, from, next) => {
        const chatUuid = to.params.chatUuid;
        if (!chatUuid) {
          console.warn('Chat UUID is missing');
          return next({ name: 'chatList' });
        }


        try {
          const response = await fetch(`/api/chat/status/${chatUuid}`, {
            headers: {
              'X-Telegram-Data': window.Telegram.WebApp.initData,
            },
          });
          const { blocked } = await response.json();
          if (!response.ok) throw new Error('Failed to fetch chat status');
          if (blocked) {
            console.warn('Chat is blocked');
            return next({ name: 'chatList' });
          }
          next();
        } catch (error) {
          console.error('Error checking chat status:', error);
          next({ name: 'chatList' });
        }
      },
    },
    {
      path: '/chats',
      name: 'chatList',
      component: () => import('../views/ChatListView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFound.vue'),
    },
  ],
});

export default router;