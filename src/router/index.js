import { createRouter, createWebHistory } from 'vue-router'
import { getSession } from '../services/api.js'

const routes = [
  { path: '/login', name: 'login', component: () => import('../pages/LoginPage.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('../layouts/AppLayout.vue'),
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard',    name: 'dashboard',    meta: { title: 'Inicio' },        component: () => import('../pages/DashboardPage.vue') },
      { path: 'clientes',     name: 'clientes',     meta: { title: 'Clientes' },      component: () => import('../pages/clientes/ClientesPage.vue') },
      { path: 'productos',    name: 'productos',    meta: { title: 'Productos' },     component: () => import('../pages/productos/ProductosPage.vue') },
      { path: 'ordenes',      name: 'ordenes',      meta: { title: 'Órdenes' },       component: () => import('../pages/ordenes/OrdenesPage.vue') },
      { path: 'ordenes/nueva',name: 'ordenes-nueva',meta: { title: 'Nueva Orden' },   component: () => import('../pages/ordenes/NuevaOrdenPage.vue') },
      { path: 'aprobaciones',  name: 'aprobaciones',  meta: { title: 'Aprobaciones' },  component: () => import('../pages/AprobacionesPage.vue') },
      { path: 'mantenimiento', name: 'mantenimiento', meta: { title: 'Mantenimiento' }, component: () => import('../pages/MantenimientoPage.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  if (!to.meta.public && !getSession()) return '/login'
})

export default router
