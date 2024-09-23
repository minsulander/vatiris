import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'main',
      component: () => import("@/views/Main.vue")
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import("@/views/Privacy.vue")
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'main',
      component: () => import("@/views/Main.vue")
    }
  ]
})

export default router
