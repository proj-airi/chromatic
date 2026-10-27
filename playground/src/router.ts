import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { component: () => import('./pages/docs.vue'), name: 'docs', path: '/' },
    // Heavy (fitting, heatmaps, three.js): only loaded when visited.
    { component: () => import('./pages/lab.vue'), name: 'lab', path: '/lab' },
  ],
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})
