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

function estadoBadge(e) {
  return { aprobada:'badge-green', pendiente_aprobacion:'badge-amber', borrador:'badge-stone', rechazada:'badge-red', completada:'badge-blue' }[e] || 'badge-stone'
}
function estadoLabel(e) {
  return { aprobada:'aprobada', pendiente_aprobacion:'pend. aprobación', borrador:'borrador', rechazada:'rechazada', completada:'finalizada' }[e] || e
}

// Tabla de márgenes (dummy — pendiente sync costo desde Brilo)
const TABLA_MARGENES = [
  { codigo:'CB-CRAFT-KEG', nombre:'Barril 20L Cerveza Artesanal', precio_con_iva:95.00, precio_sin_iva:84.07, costo:42.00 },
  { codigo:'CB-AMBER-330', nombre:'Cerveza Amber Ale 330ml',      precio_con_iva: 2.50, precio_sin_iva: 2.21, costo: 0.85 },
  { codigo:'CB-AMBER-600', nombre:'Cerveza Amber Ale 600ml',      precio_con_iva: 4.25, precio_sin_iva: 3.76, costo: 1.40 },
  { codigo:'CB-DARK-330',  nombre:'Cerveza Dark Ale 330ml',       precio_con_iva: 2.75, precio_sin_iva: 2.43, costo: 0.90 },
  { codigo:'CB-IPA-330',   nombre:'Cerveza IPA 330ml',            precio_con_iva: 3.00, precio_sin_iva: 2.65, costo: 0.95 },
  { codigo:'CB-WHITE-330', nombre:'Cerveza White Ale 330ml',      precio_con_iva: 2.50, precio_sin_iva: 2.21, costo: 0.82 },
]

// ── ApexCharts — configuración base dark (igual que hr-rrhh) ─────────────
const apexBase = {
  chart:   { background: 'transparent', toolbar: { show: false }, fontFamily: 'inherit', animations: { enabled: true, speed: 600, easing: 'easeinout' } },
  theme:   { mode: 'dark' },
  grid:    { borderColor: '#292524', strokeDashArray: 3, xaxis: { lines: { show: false } } },
  tooltip: { theme: 'dark' },
}

// Gráfica barras: ventas mensuales + anotación de meta (dummy — prototipo)
const barSeries = [{ name: 'Ventas', data: [1850, 2200, 2800, 2100, 3200, 2699] }]
const barOpts = computed(() => ({
  ...apexBase,
  chart: { ...apexBase.chart, type: 'bar' },
  plotOptions: { bar: { borderRadius: 4, columnWidth: '58%', dataLabels: { position: 'top' } } },
  colors: ['#d97706'],
  fill: { type: 'gradient', gradient: { type: 'vertical', gradientToColors: ['#f59e0b'], opacityFrom: 0.92, opacityTo: 0.72 } },
  dataLabels: { enabled: true, formatter: v => `$${(v/1000).toFixed(1)}k`, style: { fontSize: '10px', colors: ['#fbbf24'] }, offsetY: -18 },
  xaxis: {
    categories: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
    labels: { style: { colors: '#78716c', fontSize: '11px' } },
    axisBorder: { color: '#292524' }, axisTicks: { color: '#292524' },
  },
  yaxis: { labels: { style: { colors: '#78716c', fontSize: '10px' }, formatter: v => `$${(v/1000).toFixed(0)}k` }, min: 0, max: 3600 },
  annotations: {
    yaxis: [{
      y: 2500, borderColor: '#10b981', borderWidth: 1.5, strokeDashArray: 5,
      label: { text: 'Meta $2,500', borderColor: '#10b981', borderWidth: 0, style: { color: '#10b981', background: 'transparent', fontSize: '10px' }, position: 'right', offsetX: -12 }
    }]
  },
  tooltip: { theme: 'dark', y: { formatter: v => new Intl.NumberFormat('es-SV',{style:'currency',currency:'USD'}).format(v) } },
}))

// Gráfica donut: distribución por línea de producto (dummy — prototipo)
const donutSeries = [38, 35, 18, 9]
const donutOpts = {
  ...apexBase,
  chart: { ...apexBase.chart, type: 'donut' },
  colors: ['#f59e0b', '#ea580c', '#eab308', '#78716c'],
  labels: ['Barriles', 'Botella 330ml', 'Botella 600ml', 'Merch & Otros'],
  legend: { show: false },
  dataLabels: { enabled: false },
  plotOptions: { pie: { donut: { size: '70%', labels: { show: true, total: { show: true, label: 'Líneas', fontSize: '11px', color: '#78716c', formatter: () => '4 líneas' } } } } },
  stroke: { width: 2, colors: ['#1c1917'] },
  tooltip: { theme: 'dark', y: { formatter: v => `${v}%` } },
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
          <!-- Aging breakdown -->
          <div v-if="stats.creditos_aging" class="mt-3 pt-3 border-t border-stone-800/60 space-y-1.5">
            <div class="flex justify-between text-[10px]">
              <span class="text-stone-500">Corriente</span>
              <span class="text-emerald-400 font-semibold tabular-nums">{{ fmt(stats.creditos_aging.corriente) }}</span>
            </div>
            <div class="flex justify-between text-[10px]">
              <span class="text-stone-500">Vencido 1-30 días</span>
              <span class="text-amber-400 font-semibold tabular-nums">{{ fmt(stats.creditos_aging.vencido_30) }}</span>
            </div>
            <div class="flex justify-between text-[10px]">
              <span class="text-stone-500">Vencido 31-60 días</span>
              <span class="text-orange-400 font-semibold tabular-nums">{{ fmt(stats.creditos_aging.vencido_60) }}</span>
            </div>
            <div class="flex justify-between text-[10px]">
              <span class="text-stone-500">Vencido +60 días</span>
              <span class="text-red-400 font-semibold tabular-nums">{{ fmt(stats.creditos_aging.vencido_mas) }}</span>
            </div>
          </div>
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
            <div class="flex items-center gap-3 text-[11px] text-stone-500">
              <span class="flex items-center gap-1.5"><span class="inline-block w-3 h-2.5 rounded-sm bg-amber-600/80" />Ventas</span>
              <span class="flex items-center gap-1.5"><span class="inline-block w-4 border-t-2 border-dashed border-emerald-500/80" />Meta $2,500</span>
            </div>
          </div>
          <apexchart type="bar" height="220" width="100%" :options="barOpts" :series="barSeries" />
        </div>

        <!-- Distribución por producto (donut) -->
        <div class="card flex flex-col">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-7 h-7 rounded-lg bg-stone-800 flex items-center justify-center">
              <i class="fa-solid fa-chart-pie text-stone-400 text-xs" />
            </div>
            <h3 class="font-semibold text-neutral-100 text-sm">Por línea de producto</h3>
          </div>
          <div class="flex-1 flex flex-col">
            <apexchart type="donut" height="170" width="100%" :options="donutOpts" :series="donutSeries" />
            <div class="space-y-1.5 mt-1">
              <div v-for="(pct, i) in donutSeries" :key="i" class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0" :style="`background:${donutOpts.colors[i]}`" />
                  <span class="text-xs text-stone-300 truncate">{{ donutOpts.labels[i] }}</span>
                </div>
                <span class="text-xs font-semibold tabular-nums" :style="`color:${donutOpts.colors[i]}`">{{ pct }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Top productos + Top clientes + Últimas órdenes -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        <!-- Top productos -->
        <div class="card">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-7 h-7 rounded-lg bg-amber-900/30 flex items-center justify-center">
              <i class="fa-solid fa-ranking-star text-amber-500 text-xs" />
            </div>
            <h3 class="font-semibold text-neutral-100 text-sm">Top productos del mes</h3>
          </div>
          <div v-if="!stats.ventas_por_producto.length" class="text-center py-8 text-stone-600">
            <i class="fa-solid fa-box-open text-2xl mb-2 block opacity-30" />Sin datos aún
          </div>
          <div v-else class="space-y-2.5">
            <div v-for="(p, i) in stats.ventas_por_producto" :key="p.nombre_producto" class="flex items-center gap-3">
              <span class="text-xs text-stone-700 w-4 text-right tabular-nums flex-shrink-0">{{ i+1 }}</span>
              <div class="flex-1 min-w-0">
                <div class="text-sm text-stone-300 truncate">{{ p.nombre_producto }}</div>
                <div class="h-1 bg-stone-800 rounded-full mt-1.5 overflow-hidden">
                  <div class="h-full bg-amber-600/60 rounded-full" :style="`width:${Math.round((p.total/stats.ventas_por_producto[0].total)*100)}%`" />
                </div>
              </div>
              <span class="text-xs font-semibold text-amber-400 tabular-nums flex-shrink-0">{{ fmt(p.total) }}</span>
            </div>
          </div>
        </div>

        <!-- Top clientes -->
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-blue-900/30 flex items-center justify-center">
                <i class="fa-solid fa-trophy text-blue-400 text-xs" />
              </div>
              <h3 class="font-semibold text-neutral-100 text-sm">Top clientes del mes</h3>
            </div>
            <span v-if="stats.clientes_nuevos" class="badge badge-green text-[10px]">
              <i class="fa-solid fa-user-plus" />+{{ stats.clientes_nuevos }} nuevos
            </span>
          </div>
          <div v-if="!stats.top_clientes?.length" class="text-center py-8 text-stone-600">
            <i class="fa-solid fa-users text-2xl mb-2 block opacity-30" />Sin datos aún
          </div>
          <div v-else class="space-y-2.5">
            <div v-for="(c, i) in stats.top_clientes" :key="c.id" class="flex items-center gap-3">
              <span class="text-xs text-stone-700 w-4 text-right tabular-nums flex-shrink-0">{{ i+1 }}</span>
              <div class="flex-1 min-w-0">
                <div class="text-sm text-stone-300 truncate">{{ c.nom_comercial || c.nombres }}</div>
                <div class="h-1 bg-stone-800 rounded-full mt-1.5 overflow-hidden">
                  <div class="h-full bg-blue-600/50 rounded-full" :style="`width:${Math.round((c.total/stats.top_clientes[0].total)*100)}%`" />
                </div>
              </div>
              <span class="text-xs font-semibold text-blue-300 tabular-nums flex-shrink-0">{{ fmt(c.total) }}</span>
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
          <div v-if="!stats.ultimas_ordenes.length" class="text-center py-8 text-stone-600">
            <i class="fa-solid fa-file-invoice text-2xl mb-2 block opacity-30" />Sin órdenes aún
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
                <span class="badge text-[10px]" :class="estadoBadge(o.estado)">{{ estadoLabel(o.estado) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabla de márgenes por producto -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-stone-800 flex items-center justify-center">
              <i class="fa-solid fa-table text-stone-400 text-xs" />
            </div>
            <h3 class="font-semibold text-neutral-100 text-sm">Márgenes por producto</h3>
          </div>
          <span class="badge badge-stone text-[10px]"><i class="fa-solid fa-clock-rotate-left mr-1" />Costos pendiente sync Brilo</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-stone-800 text-stone-500">
                <th class="px-3 py-2 text-left font-medium">Producto</th>
                <th class="px-3 py-2 text-right font-medium">P. Venta c/IVA</th>
                <th class="px-3 py-2 text-right font-medium">P. Venta s/IVA</th>
                <th class="px-3 py-2 text-right font-medium">Costo</th>
                <th class="px-3 py-2 text-right font-medium">Margen</th>
                <th class="px-3 py-2 text-right font-medium">% Costo</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-800/50">
              <tr v-for="p in TABLA_MARGENES" :key="p.codigo" class="hover:bg-stone-800/20 transition-colors">
                <td class="px-3 py-2.5">
                  <div class="font-medium text-stone-200">{{ p.nombre }}</div>
                  <div class="text-stone-600 font-mono text-[10px]">{{ p.codigo }}</div>
                </td>
                <td class="px-3 py-2.5 text-right tabular-nums text-emerald-400 font-semibold">${{ p.precio_con_iva.toFixed(2) }}</td>
                <td class="px-3 py-2.5 text-right tabular-nums text-stone-400">${{ p.precio_sin_iva.toFixed(2) }}</td>
                <td class="px-3 py-2.5 text-right tabular-nums text-stone-400">${{ p.costo.toFixed(2) }}</td>
                <td class="px-3 py-2.5 text-right tabular-nums text-amber-400 font-semibold">
                  ${{ (p.precio_sin_iva - p.costo).toFixed(2) }}
                </td>
                <td class="px-3 py-2.5 text-right">
                  <span class="tabular-nums font-semibold"
                    :class="(p.costo/p.precio_sin_iva) < 0.45 ? 'text-emerald-400' : (p.costo/p.precio_sin_iva) < 0.6 ? 'text-amber-400' : 'text-red-400'">
                    {{ Math.round((p.costo / p.precio_sin_iva) * 100) }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
