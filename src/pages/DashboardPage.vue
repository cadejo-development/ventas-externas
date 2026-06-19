<script setup>
import { ref, computed, onMounted } from 'vue'
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

// --- Gráficas (datos dummy — prototipo) ---
const VENTAS_MESES = [
  { mes: 'Ene', total: 1850 },
  { mes: 'Feb', total: 2200 },
  { mes: 'Mar', total: 2800 },
  { mes: 'Abr', total: 2100 },
  { mes: 'May', total: 3200 },
  { mes: 'Jun', total: 2699 },
]
const META = 2500

const barChart = computed(() => {
  const L=50, B=168, W=540, H=150, MAX=3600
  const sc = H / MAX
  const slotW = W / VENTAS_MESES.length
  const bW = 48
  return {
    bars: VENTAS_MESES.map((d, i) => ({
      x:    L + i * slotW + (slotW - bW) / 2,
      y:    B - d.total * sc,
      h:    d.total * sc,
      w:    bW,
      lx:   L + i * slotW + slotW / 2,
      mes:  d.mes,
      total: d.total,
      over: d.total >= META,
    })),
    gridlines: [1000, 2000, 3000].map(v => ({ y: B - v * sc, label: `$${v/1000}k` })),
    metaY: B - META * sc,
    x0: L, x1: L + W, yB: B,
  }
})

const DISTRIBUCION = [
  { label: 'Barriles',      pct: 38, color: '#f59e0b' },
  { label: 'Botella 330ml', pct: 35, color: '#ea580c' },
  { label: 'Botella 600ml', pct: 18, color: '#eab308' },
  { label: 'Merch & Otros', pct:  9, color: '#78716c' },
]

const donutSegs = computed(() => {
  const r = 68, circ = 2 * Math.PI * r
  let cumPct = 0
  return DISTRIBUCION.map(d => {
    const len = (d.pct / 100) * circ
    const seg = {
      ...d,
      dasharray:  `${len.toFixed(1)} ${(circ - len).toFixed(1)}`,
      dashoffset: (circ * (1 - cumPct / 100)).toFixed(1),
    }
    cumPct += d.pct
    return seg
  })
})
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

      <!-- Charts row -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        <!-- Ventas mensuales (barras + meta) -->
        <div class="card lg:col-span-2">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-amber-900/30 flex items-center justify-center">
                <i class="fa-solid fa-chart-bar text-amber-500 text-xs" />
              </div>
              <h3 class="font-semibold text-neutral-100 text-sm">Ventas mensuales 2026</h3>
            </div>
            <div class="flex items-center gap-4 text-[11px] text-stone-500">
              <span class="flex items-center gap-1.5">
                <span class="inline-block w-3 h-2.5 rounded-sm bg-amber-700/80" />Ventas
              </span>
              <span class="flex items-center gap-1.5">
                <span class="inline-block w-4 border-t-2 border-dashed border-emerald-500/80" />Meta $2,500
              </span>
            </div>
          </div>
          <svg viewBox="0 0 640 192" class="w-full overflow-visible">
            <!-- Gridlines y etiquetas Y -->
            <g v-for="g in barChart.gridlines" :key="g.label">
              <line :x1="barChart.x0" :y1="g.y" :x2="barChart.x1" :y2="g.y"
                    stroke="#292524" stroke-width="1" />
              <text :x="barChart.x0 - 6" :y="g.y + 3.5" text-anchor="end"
                    fill="#57534e" font-size="9">{{ g.label }}</text>
            </g>
            <!-- Eje base -->
            <line :x1="barChart.x0" :y1="barChart.yB" :x2="barChart.x1" :y2="barChart.yB"
                  stroke="#292524" stroke-width="1" />
            <!-- Barras -->
            <g v-for="b in barChart.bars" :key="b.mes">
              <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="3"
                    :fill="b.over ? '#d97706' : '#92400e'" opacity="0.9" />
              <text :x="b.lx" :y="b.y - 5" text-anchor="middle"
                    :fill="b.over ? '#fbbf24' : '#a16207'" font-size="8.5" font-weight="600">
                ${{ (b.total / 1000).toFixed(1) }}k
              </text>
              <text :x="b.lx" :y="barChart.yB + 14" text-anchor="middle"
                    fill="#78716c" font-size="9">{{ b.mes }}</text>
            </g>
            <!-- Línea meta -->
            <line :x1="barChart.x0" :y1="barChart.metaY" :x2="barChart.x1" :y2="barChart.metaY"
                  stroke="#10b981" stroke-width="1.5" stroke-dasharray="5,4" opacity="0.8" />
            <text :x="barChart.x1 + 4" :y="barChart.metaY + 4" fill="#10b981" font-size="8.5">Meta</text>
          </svg>
        </div>

        <!-- Distribución por producto (donut) -->
        <div class="card flex flex-col">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-7 h-7 rounded-lg bg-stone-800 flex items-center justify-center">
              <i class="fa-solid fa-chart-pie text-stone-400 text-xs" />
            </div>
            <h3 class="font-semibold text-neutral-100 text-sm">Por línea de producto</h3>
          </div>
          <div class="flex flex-col items-center gap-5 flex-1 justify-center">
            <svg viewBox="0 0 200 200" class="w-36 h-36 -rotate-90">
              <circle v-for="s in donutSegs" :key="s.label"
                cx="100" cy="100" r="68" fill="none"
                :stroke="s.color" stroke-width="32"
                :stroke-dasharray="s.dasharray"
                :stroke-dashoffset="s.dashoffset" />
            </svg>
            <div class="w-full space-y-2">
              <div v-for="s in donutSegs" :key="s.label" class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0" :style="`background:${s.color}`" />
                  <span class="text-xs text-stone-300 truncate">{{ s.label }}</span>
                </div>
                <span class="text-xs font-semibold tabular-nums" :style="`color:${s.color}`">{{ s.pct }}%</span>
              </div>
            </div>
          </div>
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
