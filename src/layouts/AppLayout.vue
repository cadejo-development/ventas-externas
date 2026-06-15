<template>
  <div class="flex h-screen overflow-hidden bg-stone-950">

    <!-- Sidebar -->
    <aside class="hidden xl:flex flex-col w-64 flex-shrink-0 border-r border-stone-800/60"
           style="background: linear-gradient(180deg, #0c0a09 0%, #111110 100%)">

      <!-- Brand -->
      <div class="flex items-center gap-3 px-5 pt-6 pb-5 border-b border-stone-800/60">
        <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
          <img src="https://cadejo-storage.s3.us-east-2.amazonaws.com/public/logo2.png"
               class="w-8 h-8 object-contain" alt="Cadejo" />
        </div>
        <div class="min-w-0">
          <div class="text-sm font-bold text-amber-400 leading-tight truncate">Cadejo Ventas</div>
          <div class="text-[10px] text-stone-500 truncate">Ventas Externas</div>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-hide">

        <div class="px-3 pb-1 pt-2">
          <span class="text-[9px] font-bold uppercase tracking-[0.15em] text-stone-600">Principal</span>
        </div>
        <SidebarNavItem to="/dashboard" icon="fa-solid fa-chart-pie">Inicio</SidebarNavItem>

        <div class="px-3 pb-1 pt-4">
          <span class="text-[9px] font-bold uppercase tracking-[0.15em] text-stone-600">Ventas</span>
        </div>
        <SidebarNavItem to="/clientes"  icon="fa-solid fa-building">Clientes</SidebarNavItem>
        <SidebarNavItem to="/productos" icon="fa-solid fa-cubes">Productos</SidebarNavItem>
        <SidebarNavItem to="/ordenes"   icon="fa-solid fa-file-invoice-dollar">Órdenes</SidebarNavItem>
        <SidebarNavItem v-if="session?.rol === 'jefe_ventas'" to="/aprobaciones" icon="fa-solid fa-shield-check">
          Aprobaciones
          <template v-if="pendientes > 0">
            <span class="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-px min-w-[18px] text-center">
              {{ pendientes }}
            </span>
          </template>
        </SidebarNavItem>
      </nav>

      <!-- User footer -->
      <div class="px-3 pb-4">
        <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-stone-900/60 border border-stone-800/60">
          <div class="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30
                      flex items-center justify-center text-amber-400 font-bold text-sm flex-shrink-0">
            {{ initial }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-semibold text-neutral-200 truncate">{{ session?.nombre }}</div>
            <div class="text-[10px] text-stone-500 capitalize truncate">{{ session?.rol?.replace('_', ' ') }}</div>
          </div>
          <button @click="logout" title="Cerrar sesión"
            class="text-stone-600 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-stone-800 flex-shrink-0">
            <i class="fa-solid fa-right-from-bracket text-xs" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Mobile overlay -->
    <Transition name="fade">
      <div v-if="mobileOpen" class="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm xl:hidden"
           @click="mobileOpen = false" />
    </Transition>

    <!-- Mobile drawer -->
    <Transition name="slide-x">
      <aside v-if="mobileOpen" class="fixed inset-y-0 left-0 w-64 z-50 bg-stone-950 border-r border-stone-800/60 flex flex-col xl:hidden shadow-2xl">
        <div class="flex items-center gap-3 px-5 pt-6 pb-5 border-b border-stone-800/60">
          <div class="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <img src="https://cadejo-storage.s3.us-east-2.amazonaws.com/public/logo2.png"
                 class="w-7 h-7 object-contain" alt="Cadejo" />
          </div>
          <div class="font-bold text-sm text-amber-400">Cadejo Ventas</div>
          <button @click="mobileOpen = false" class="ml-auto text-stone-500 hover:text-stone-300">
            <i class="fa-solid fa-xmark" />
          </button>
        </div>
        <nav class="flex-1 px-3 py-4 space-y-0.5">
          <SidebarNavItem to="/dashboard" icon="fa-solid fa-chart-pie" @click="mobileOpen=false">Inicio</SidebarNavItem>
          <SidebarNavItem to="/clientes"  icon="fa-solid fa-building"  @click="mobileOpen=false">Clientes</SidebarNavItem>
          <SidebarNavItem to="/productos" icon="fa-solid fa-cubes"     @click="mobileOpen=false">Productos</SidebarNavItem>
          <SidebarNavItem to="/ordenes"   icon="fa-solid fa-file-invoice-dollar" @click="mobileOpen=false">Órdenes</SidebarNavItem>
          <SidebarNavItem v-if="session?.rol === 'jefe_ventas'" to="/aprobaciones" icon="fa-solid fa-shield-check" @click="mobileOpen=false">Aprobaciones</SidebarNavItem>
        </nav>
      </aside>
    </Transition>

    <!-- Main content -->
    <div class="flex flex-col flex-1 min-w-0 overflow-hidden">

      <!-- Top header -->
      <header class="flex items-center gap-3 px-5 xl:px-6 h-14 border-b border-stone-800/60 bg-stone-950/80 backdrop-blur-sm flex-shrink-0 z-30">

        <!-- Mobile menu btn -->
        <button @click="mobileOpen = true" class="xl:hidden text-stone-400 hover:text-amber-400 p-1.5 rounded-lg hover:bg-stone-800 transition-colors">
          <i class="fa-solid fa-bars" />
        </button>

        <!-- Breadcrumb -->
        <div class="flex items-center gap-1.5 text-sm">
          <span class="text-stone-600 hidden sm:inline">Ventas Externas</span>
          <i class="fa-solid fa-chevron-right text-[9px] text-stone-700 hidden sm:inline" />
          <span class="text-amber-400/90 font-semibold">{{ pageTitle }}</span>
        </div>

        <!-- Right side -->
        <div class="ml-auto flex items-center gap-3">
          <!-- Aprobaciones badge en header -->
          <RouterLink v-if="session?.rol === 'jefe_ventas'" to="/aprobaciones"
            class="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-amber-400 transition-colors"
            title="Aprobaciones pendientes">
            <i class="fa-solid fa-bell text-sm" />
            <span v-if="pendientes > 0"
              class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
              {{ pendientes }}
            </span>
          </RouterLink>

          <div class="hidden sm:flex flex-col items-end">
            <span class="text-xs font-semibold text-neutral-200 leading-tight">{{ session?.nombre }}</span>
            <span class="text-[10px] text-stone-500 leading-tight capitalize">{{ session?.rol?.replace('_',' ') }}</span>
          </div>

          <div class="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/25
                      flex items-center justify-center text-amber-400 font-bold text-sm">
            {{ initial }}
          </div>

          <button @click="logout"
            class="hidden sm:flex items-center gap-1.5 text-xs text-stone-500 hover:text-amber-400
                   transition-colors px-2.5 py-1.5 rounded-lg hover:bg-stone-800">
            <i class="fa-solid fa-right-from-bracket" />
            <span>Salir</span>
          </button>
        </div>
      </header>

      <!-- Page -->
      <main class="flex-1 overflow-y-auto px-5 xl:px-8 py-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getSession, clearSession } from '../services/api.js'
import SidebarNavItem from '../components/SidebarNavItem.vue'
import api from '../services/api.js'

const route   = useRoute()
const router  = useRouter()
const session = getSession()
const mobileOpen = ref(false)
const pendientes = ref(0)

const initial   = computed(() => session?.nombre?.charAt(0).toUpperCase() ?? '?')
const pageTitle = computed(() => route.meta?.title ?? 'Ventas Externas')

function logout() { clearSession(); router.push('/login') }

// Cargar aprobaciones pendientes para badge
onMounted(async () => {
  if (session?.rol === 'jefe_ventas') {
    try {
      const { data } = await api.get('aprobaciones', { params: { estado: 'pendiente' } })
      pendientes.value = data.length
    } catch { /* silencioso */ }
  }
})
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-x-enter-active, .slide-x-leave-active { transition: transform 0.25s cubic-bezier(0.4,0,0.2,1); }
.slide-x-enter-from, .slide-x-leave-to { transform: translateX(-100%); }
</style>
