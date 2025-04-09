import { createRouter, createWebHistory } from 'vue-router';

const originalFetch = window.fetch;
window.fetch = async function (...args) {
  try {
    const response = await originalFetch(...args);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    router.push({ name: 'not-found', query: { error: error.message } });
    throw error;
  }
};

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
          return next({ name: 'chatList' });
        }
        try {
          const response = await fetch(`https://jobs.cloudpub.ru/api/chat/status/${chatUuid}`, {
            headers: {
              'X-Telegram-Data': window.Telegram.WebApp.initData,
            },
          });
          if (!response.ok) {
            return next({ name: 'not-found' });
          }
          const text = await response.text();
          const data = JSON.parse(text);
          const { blocked } = data;
          if (blocked) {
            return next({ name: 'chatList' });
          }
          next();
        } catch (error) {
          console.error('Navigation error:', error);
          next({ name: 'not-found' });
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

router.onError((error) => {
  console.error('Router error:', error);
  router.push({ name: 'not-found', query: { error: error.message } });
});

router.beforeEach((to, from, next) => {
  if (router.resolve(to).matched.length === 0) {
    next({ name: 'not-found' });
  } else {
    next();
  }
});

const originalWebSocket = window.WebSocket;
window.WebSocket = function (...args) {
  const ws = new originalWebSocket(...args);
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    router.push({ name: 'not-found', query: { error: 'WebSocket connection failed' } });
  };
  ws.onclose = (event) => {
    if (!event.wasClean) {
      console.error('WebSocket disconnected:', event);
      router.push({ name: 'not-found', query: { error: 'WebSocket disconnected unexpectedly' } });
    }
  };
  return ws;
};

export default router;