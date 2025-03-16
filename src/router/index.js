import { createRouter, createWebHistory } from 'vue-router';
import ChatView from './views/ChatView.vue';
import ChatListView from './views/ChatListView.vue';
import HomeView from './views/HomeView.vue';
import ProfileView from './views/ProfileView.vue';

const routes = [
  { path: '/', component: HomeView },
  { path: '/chats', component: ChatListView },
  { path: '/chat/:chatId', component: ChatView, props: true },
  { path: '/profile/:userId', component: ProfileView },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;