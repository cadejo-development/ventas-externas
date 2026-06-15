<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api.js'

const stats   = ref(null)
const loading = ref(true)

onMounted(async () => {
  try { const { data } = await api.get('dashboard'); stats.value = data }
  catch { /* silencioso */ }
  finally { loading.value = false }
})

function fmt(n) { return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(n || 0) }

const estadoBadge = {
  aprobada:            'badge-green',
  pendiente_aprobacion:'badge-amber',
  borrador:            'badge-stone',
  rechazada:           'badge-red',
  completada:          'badge-blue',
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-neutral-100">Inicio</h1>
      <p class="text-sm text-stone-500 mt-0.5">Resumen de ventas del mes en curso</p>
    </div>

    <!-- Skeleton -->
    <div v-if="loading" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div v-for="i in 4" :key="i" class="card animate-pulse">
        <div class="h-2.5 bg-stone-800 rounded w-1/2 mb-3" />
        <div class="h-7 bg-stone-700 rounded w-3/4 mb-1" />
        <div class="h-2 bg-stone-800 rounded w-1/3" />
      </div>
    </div>

    <template v-else-if="stats">
      <!-- KPI cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

        <div class="card group hover:border-amber-800/40 transition-colors">
          <div class="flex items-start justify-between mb-3">
            <span class="text-xs font-semibold text-stone-500 uppercase tracking-wider">Ventas del mes</span>
            <div class="w-8 h-8 rounded-lg bg-amber-900/30 flex items-center justify-center">
              <i class="fa-solid fa-arrow-trend-up text-amber-500 text-sm" />
            </div>
          </div>
          <div class="text-2xl font-bold text-amber-400 tabular-nums">{{ fmt(stats.ventas_mes.total) }}</div>
          <div class="text-xs text-stone-500 mt-1">{{ stats.ventas_mes.num_ordenes }} órdenes</div>
        </div>

        <div class="card hover:border-green-900/40 transition-colors">
          <div class="flex items-start justify-between mb-3">
            <span class="text-xs font-semibold text-stone-500 uppercase tracking-wider">Ventas contado</span>
            <div class="w-8 h-8 rounded-lg bg-green-900/30 flex items-center justify-center">
              <i class="fa-solid fa-money-bill-wave text-green-500 text-sm" />
            </div>
          </div>
          <div class="text-2xl font-bold text-green-400 tabular-nums">{{ fmt(stats.ventas_contado.total) }}</div>
          <div class="text-xs text-stone-500 mt-1">{{ stats.ventas_contado.cantidad }} órdenes</div>
        </div>

        <div class="card hover:border-blue-900/40 transition-colors">
          <div class="flex items-start justify-between mb-3">
            <span class="text-xs font-semibold text-stone-500 uppercase tracking-wider">Créditos pendientes</span>
            <div class="w-8 h-8 rounded-lg bg-blue-900/30 flex items-center justify-center">
              <i class="fa-solid fa-clock text-blue-400 text-sm" />
            </div>
          </div>
          <div class="text-2xl font-bold text-blue-300 tabular-nums">{{ fmt(stats.creditos_pendientes.monto) }}</div>
          <div class="text-xs text-stone-500 mt-1">{{ stats.creditos_pendientes.cantidad }} órdenes</div>
        </div>

        <div class="card" :class="stats.aprobaciones_pendientes > 0 ? 'border-red-900/40' : ''">
          <div class="flex items-start justify-between mb-3">
            <span class="text-xs font-semibold text-stone-500 uppercase tracking-wider">Aprobaciones</span>
            <div class="w-8 h-8 rounded-lg flex items-center justify-center"
                 :class="stats.aprobaciones_pendientes > 0 ? 'bg-red-900/30' : 'bg-stone-800'">
              <i class="fa-solid fa-bell text-sm" :class="stats.aprobaciones_pendientes > 0 ? 'text-red-400' : 'text-stone-600'" />
            </div>
          </div>
          <div class="text-2xl font-bold tabular-nums" :class="stats.aprobaciones_pendientes > 0 ? 'text-red-400' : 'text-stone-600'">
            {{ stats.aprobaciones_pendientes }}
          </div>
          <div class="text-xs text-stone-500 mt-1">solicitudes pendientes</div>
        </div>
      </div>

      <!-- Grids inferiores -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <!-- Top productos -->
        <div class="card">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-7 h-7 rounded-lg bg-amber-900/30 flex items-center justify-center">
              <i class="fa-solid fa-ranking-star text-amber-500 text-xs" />
            </div>
            <h3 class="font-semibold text-neutral-100 text-sm">Top productos del mes</h3>
          </div>
          <div v-if="!stats.ventas_por_producto.length"
            class="text-center py-8 text-stone-600">
            <i class="fa-solid fa-box-open text-2xl mb-2 block opacity-30" />
            Sin datos aún
          </div>
          <div v-else class="space-y-2.5">
            <div v-for="(p, i) in stats.ventas_por_producto" :key="p.nombre_producto"
              class="flex items-center gap-3">
              <span class="text-xs text-stone-700 w-4 text-right tabular-nums flex-shrink-0">{{ i+1 }}</span>
              <div class="flex-1 min-w-0">
                <div class="text-sm text-stone-300 truncate">{{ p.nombre_producto }}</div>
                <div class="h-1 bg-stone-800 rounded-full mt-1.5 overflow-hidden">
                  <div class="h-full bg-amber-600/60 rounded-full" :style="`width:${Math.round((p.total / stats.ventas_por_producto[0].total) * 100)}%`" />
                </div>
              </div>
              <span class="text-xs font-semibold text-amber-400 tabular-nums flex-shrink-0">{{ fmt(p.total) }}</span>
            </div>
          </div>
        </div>

        <!-- Últimas órdenes -->
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-stone-800 flex items-center justify-center">
                <i class="fa-solid fa-clock-rotate-left text-stone-400 text-xs" />
              </div>
              <h3 class="font-semibold text-neutral-100 text-sm">Últimas órdenes</h3>
            </div>
            <RouterLink to="/ordenes" class="text-xs text-amber-500 hover:text-amber-400 transition-colors">
              Ver todas <i class="fa-solid fa-arrow-right ml-1 text-[10px]" />
            </RouterLink>
          </div>
          <div v-if="!stats.ultimas_ordenes.length"
            class="text-center py-8 text-stone-600">
            <i class="fa-solid fa-file-invoice text-2xl mb-2 block opacity-30" />
            Sin órdenes aún
          </div>
          <div v-else class="space-y-2">
            <div v-for="o in stats.ultimas_ordenes" :key="o.id"
              class="flex items-center gap-3 py-2 border-b border-stone-800/50 last:border-0">
              <div class="w-8 h-8 rounded-lg bg-stone-800/60 flex items-center justify-center flex-shrink-0">
                <i class="fa-solid fa-file-invoice-dollar text-stone-500 text-xs" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium text-neutral-100 truncate">{{ o.cliente }}</div>
                <div class="text-xs text-stone-500">{{ o.created_at?.slice(0, 10) }}</div>
              </div>
              <div class="flex-shrink-0 text-right">
                <div class="text-sm font-bold text-amber-400 tabular-nums">{{ fmt(o.total) }}</div>
                <span class="badge text-[10px]" :class="estadoBadge[o.estado] || 'badge-stone'">
                  {{ o.estado.replace('_',' ') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
