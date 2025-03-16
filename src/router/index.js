import { createRouter, createWebHistory } from 'vue-router';
import ChatView from './views/ChatView.vue';
import ChatListView from './views/ChatListView.vue';
import HomeView from './views/HomeView.vue';
import ProfileView from './views/ProfileView.vue';


const routes = [
  {
    path: '/',
    component: HomeView,
    name: 'home'
  },
  {
    path: '/chats',
    component: ChatListView,
    name: 'chat-list'
  },
  {
    path: '/chat/:chatId',
    component: ChatView,
    props: true,
    name: 'chat',
    beforeEnter: (to, from, next) => {
      const chatId = to.params.chatId;
      if (!chatId || !chatId.includes('_')) {
        console.warn('Invalid chatId format. Expected: jobId_targetUserId');
        next('/chats');
      } else {
        next();
      }
    }
  },
  {
    path: '/profile/:userId',
    component: ProfileView,
    name: 'profile',
    props: true
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;