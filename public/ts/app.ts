const { createApp } = Vue;
const { createRouter, createWebHashHistory } = VueRouter;

// ========== Route Guards ==========
function requireAuth(to) {
  if (!store.user) return '/login';
  return true;
}

function redirectIfAuth(to) {
  if (store.user) return '/chat';
  return true;
}

// ========== Router ==========
const routes = [
  { path: '/', redirect: '/chat' },
  { path: '/login', component: LoginPage, beforeEnter: redirectIfAuth },
  { path: '/register', component: LoginPage, beforeEnter: redirectIfAuth },
  { path: '/chat', component: ChatPage, beforeEnter: requireAuth },
  { path: '/chat/:roomId', component: ChatPage, beforeEnter: requireAuth },
  { path: '/details/:roomId', component: DetailsPage, beforeEnter: requireAuth },
  { path: '/contacts', component: ContactsPage, beforeEnter: requireAuth },
  { path: '/settings', component: SettingsPage, beforeEnter: requireAuth },
  { path: '/:pathMatch(.*)*', redirect: '/chat' },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// ========== App ==========
const app = createApp({
  template: '<router-view v-slot="{ Component }"><transition name="page" mode="out-in"><component :is="Component" /></transition></router-view>',
});

app.use(router);
app.mount('#app');
