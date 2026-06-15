<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../services/api.js'
import PageHeader from '../../components/PageHeader.vue'

const router  = useRouter()
const ordenes = ref([])
const meta    = ref({ current_page: 1, last_page: 1, total: 0 })
const loading = ref(true)
const filtroEstado = ref('')
const page    = ref(1)

async function cargar(p = 1) {
  page.value = p; loading.value = true
  try {
    const { data } = await api.get('ordenes', { params: { estado: filtroEstado.value, page: p } })
    ordenes.value = data.data; meta.value = data
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

onMounted(() => cargar(1))

const paginasVisibles = computed(() => {
  const t = meta.value.last_page, c = meta.value.current_page
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  return [...new Set([1, t, c, c-1, c+1].filter(p => p >= 1 && p <= t))].sort((a,b)=>a-b)
})

const estadoOpts = [
  ['', 'Todos'], ['borrador', 'Borrador'], ['pendiente_aprobacion', 'Pendiente'],
  ['aprobada', 'Aprobada'], ['rechazada', 'Rechazada'], ['completada', 'Completada'],
]

function estadoBadge(e) {
  return { aprobada: 'badge-green', pendiente_aprobacion: 'badge-amber', borrador: 'badge-stone', rechazada: 'badge-red', completada: 'badge-blue' }[e] || 'badge-stone'
}

function fmt(n) { return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(n || 0) }

// ── Drawer de detalle ─────────────────────────────────────────────────────────
const drawer       = ref(false)
const detalleOrden = ref(null)
const loadingDetalle = ref(false)

async function verDetalle(id) {
  drawer.value       = true
  loadingDetalle.value = true
  detalleOrden.value = null
  try {
    const { data } = await api.get(`ordenes/${id}`)
    detalleOrden.value = data
  } catch (e) { console.error(e) }
  finally { loadingDetalle.value = false }
}

function cerrarDrawer() { drawer.value = false }

function descargarExcel(id) {
  const url = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/cadejo-ventas')
  window.open(`${url}/ordenes/${id}/export/excel`, '_blank')
}

const estadoLabel = (e) => ({
  borrador: 'Borrador', pendiente_aprobacion: 'Pendiente de aprobación',
  aprobada: 'Aprobada', rechazada: 'Rechazada', completada: 'Completada',
}[e] || e)
</script>

<template>
  <div>
    <PageHeader title="Órdenes de venta">
      <template #actions>
        <RouterLink to="/ordenes/nueva" class="btn btn-primary">
          <i class="fa-solid fa-plus mr-2" />Nueva orden
        </RouterLink>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <div class="flex gap-1 bg-stone-800 rounded-lg p-1 mb-5 w-fit">
      <button v-for="[val, label] in estadoOpts" :key="val"
        :class="['px-3 py-1.5 rounded text-xs font-medium transition', filtroEstado === val ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-200']"
        @click="filtroEstado = val; cargar(1)">{{ label }}</button>
    </div>

    <div v-if="loading" class="table-wrapper">
      <div v-for="i in 8" :key="i" class="flex gap-4 px-4 py-3 border-b border-stone-800 animate-pulse">
        <div class="h-3 bg-stone-800 rounded w-8" /><div class="h-3 bg-stone-800 rounded flex-1" />
        <div class="h-3 bg-stone-800 rounded w-16" /><div class="h-3 bg-stone-800 rounded w-20" />
      </div>
    </div>

    <div v-else>
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs text-stone-500">{{ meta.total }} orden(es)</span>
      </div>

      <div class="table-wrapper overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr>
              <th>#</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th class="text-right">Total</th>
              <th class="text-center">Estado</th>
              <th>Fecha</th>
              <th class="text-center w-16">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in ordenes" :key="o.id" class="hover:bg-stone-800/40 transition-colors">
              <td class="px-4 py-2.5 font-mono text-amber-300 text-xs">#{{ o.id }}</td>
              <td class="px-4 py-2.5 font-medium text-neutral-100">{{ o.cliente?.nombres || '—' }}</td>
              <td class="px-4 py-2.5">
                <span class="badge" :class="o.tipo_venta === 'credito' ? 'badge-blue' : 'badge-stone'">
                  {{ o.tipo_venta }}
                </span>
              </td>
              <td class="px-4 py-2.5 text-right tabular-nums text-emerald-400 font-semibold">{{ fmt(o.total) }}</td>
              <td class="px-4 py-2.5 text-center">
                <span class="badge" :class="estadoBadge(o.estado)">{{ o.estado.replace('_', ' ') }}</span>
              </td>
              <td class="px-4 py-2.5 text-stone-400 text-xs">{{ o.created_at?.slice(0, 10) }}</td>
              <td class="px-4 py-2.5 text-center">
                <button @click="verDetalle(o.id)"
                  class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-stone-800 hover:bg-amber-600/20 hover:text-amber-400 text-stone-400 transition-colors border border-stone-700 hover:border-amber-600/40"
                  title="Ver detalle">
                  <i class="fa-solid fa-eye text-xs" />
                </button>
              </td>
            </tr>
            <tr v-if="!ordenes.length">
              <td colspan="7" class="px-4 py-16 text-center text-stone-500">
                <i class="fa-solid fa-file-invoice text-3xl text-stone-700 mb-3 block" />
                Sin órdenes aún
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="meta.last_page > 1" class="flex items-center justify-between mt-6 flex-wrap gap-2">
        <span class="text-xs text-stone-500">Página {{ meta.current_page }} de {{ meta.last_page }}</span>
        <div class="flex items-center gap-1">
          <button class="btn btn-secondary btn-xs" :disabled="meta.current_page === 1" @click="cargar(meta.current_page - 1)"><i class="fa-solid fa-chevron-left" /></button>
          <button v-for="p in paginasVisibles" :key="p" :class="['btn btn-xs', p === meta.current_page ? 'btn-primary' : 'btn-secondary']" @click="cargar(p)">{{ p }}</button>
          <button class="btn btn-secondary btn-xs" :disabled="meta.current_page === meta.last_page" @click="cargar(meta.current_page + 1)"><i class="fa-solid fa-chevron-right" /></button>
        </div>
      </div>
    </div>

    <!-- ── Drawer: detalle de orden ─────────────────────────────────────────── -->
    <Transition name="drawer-fade">
      <div v-if="drawer" class="fixed inset-0 z-50 flex" @click.self="cerrarDrawer">
        <!-- Overlay -->
        <div class="absolute inset-0 bg-black/50" @click="cerrarDrawer" />

        <!-- Panel -->
        <Transition name="drawer-slide">
          <div v-if="drawer"
            class="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-stone-950 border-l border-stone-800 shadow-2xl flex flex-col">

            <!-- Header del drawer -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-stone-800 flex-shrink-0">
              <div>
                <h2 class="text-base font-semibold text-neutral-100">
                  Detalle de orden
                  <span v-if="detalleOrden" class="text-amber-400 ml-1">#{{ detalleOrden.id }}</span>
                </h2>
                <p v-if="detalleOrden" class="text-xs text-stone-400 mt-0.5">{{ detalleOrden.cliente?.nombres }}</p>
              </div>
              <button @click="cerrarDrawer" class="text-stone-500 hover:text-stone-200 transition text-xl leading-none p-1">
                <i class="fa-solid fa-xmark" />
              </button>
            </div>

            <!-- Contenido -->
            <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              <!-- Skeleton -->
              <template v-if="loadingDetalle">
                <div class="space-y-3 animate-pulse">
                  <div class="h-4 bg-stone-800 rounded w-3/4" />
                  <div class="h-4 bg-stone-800 rounded w-1/2" />
                  <div class="h-32 bg-stone-800 rounded mt-4" />
                </div>
              </template>

              <template v-else-if="detalleOrden">

                <!-- Datos generales -->
                <div class="grid grid-cols-2 gap-3">
                  <div class="bg-stone-900 rounded-lg px-4 py-3">
                    <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">Estado</p>
                    <span class="badge text-xs" :class="estadoBadge(detalleOrden.estado)">
                      {{ estadoLabel(detalleOrden.estado) }}
                    </span>
                  </div>
                  <div class="bg-stone-900 rounded-lg px-4 py-3">
                    <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">Tipo de venta</p>
                    <span class="badge text-xs" :class="detalleOrden.tipo_venta === 'credito' ? 'badge-blue' : 'badge-stone'">
                      {{ detalleOrden.tipo_venta }}
                    </span>
                  </div>
                  <div class="bg-stone-900 rounded-lg px-4 py-3">
                    <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">Fecha</p>
                    <p class="text-sm text-neutral-200">{{ detalleOrden.created_at?.slice(0,10) }}</p>
                  </div>
                  <div class="bg-stone-900 rounded-lg px-4 py-3">
                    <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">Plazo</p>
                    <p class="text-sm text-neutral-200">
                      {{ detalleOrden.plazo_solicitado ? detalleOrden.plazo_solicitado + ' días' : 'Contado' }}
                    </p>
                  </div>
                  <div v-if="detalleOrden.creado_por" class="bg-stone-900 rounded-lg px-4 py-3">
                    <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">Creado por</p>
                    <p class="text-sm text-neutral-200">{{ detalleOrden.creado_por }}</p>
                  </div>
                  <div v-if="detalleOrden.aprobado_por" class="bg-stone-900 rounded-lg px-4 py-3">
                    <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">Aprobado por</p>
                    <p class="text-sm text-emerald-400">{{ detalleOrden.aprobado_por }}</p>
                  </div>
                </div>

                <!-- Notas -->
                <div v-if="detalleOrden.notas" class="bg-amber-950/30 border border-amber-800/30 rounded-lg px-4 py-3">
                  <p class="text-[10px] text-amber-500 uppercase tracking-wide mb-1"><i class="fa-solid fa-note-sticky mr-1" />Notas</p>
                  <p class="text-sm text-amber-200/80">{{ detalleOrden.notas }}</p>
                </div>

                <!-- Productos -->
                <div>
                  <h3 class="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
                    <i class="fa-solid fa-box mr-1" />Productos ({{ detalleOrden.items?.length }})
                  </h3>
                  <div class="rounded-lg overflow-hidden border border-stone-800">
                    <table class="w-full text-xs">
                      <thead class="bg-stone-900">
                        <tr>
                          <th class="px-3 py-2 text-left text-stone-400 font-medium">Producto</th>
                          <th class="px-3 py-2 text-center text-stone-400 font-medium">Cant.</th>
                          <th class="px-3 py-2 text-right text-stone-400 font-medium">P. Unit.</th>
                          <th class="px-3 py-2 text-right text-stone-400 font-medium">IVA</th>
                          <th class="px-3 py-2 text-right text-stone-400 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-stone-800">
                        <tr v-for="item in detalleOrden.items" :key="item.id" class="hover:bg-stone-900/50">
                          <td class="px-3 py-2.5 text-neutral-200">
                            {{ item.nombre_producto }}
                            <span v-if="item.exento" class="ml-1 text-[9px] text-stone-500 bg-stone-800 px-1 py-px rounded">exento</span>
                          </td>
                          <td class="px-3 py-2.5 text-center tabular-nums text-stone-300">{{ item.cantidad }}</td>
                          <td class="px-3 py-2.5 text-right tabular-nums text-stone-300">{{ fmt(item.precio_unitario) }}</td>
                          <td class="px-3 py-2.5 text-right tabular-nums" :class="item.iva > 0 ? 'text-amber-400/80' : 'text-stone-600'">
                            {{ item.iva > 0 ? fmt(item.iva) : '—' }}
                          </td>
                          <td class="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-400">{{ fmt(item.total) }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Totales -->
                <div class="bg-stone-900 rounded-lg overflow-hidden border border-stone-800">
                  <div class="flex justify-between px-4 py-2.5 text-sm border-b border-stone-800">
                    <span class="text-stone-400">Subtotal</span>
                    <span class="tabular-nums text-neutral-200">{{ fmt(detalleOrden.subtotal) }}</span>
                  </div>
                  <div class="flex justify-between px-4 py-2.5 text-sm border-b border-stone-800">
                    <span class="text-stone-400">IVA (13%)</span>
                    <span class="tabular-nums text-amber-400/80">{{ fmt(detalleOrden.total_iva) }}</span>
                  </div>
                  <div class="flex justify-between px-4 py-3 font-bold">
                    <span class="text-neutral-100 text-base">Total</span>
                    <span class="tabular-nums text-emerald-400 text-base">{{ fmt(detalleOrden.total) }}</span>
                  </div>
                </div>

              </template>
            </div>

            <!-- Footer: descarga Excel (solo órdenes aprobadas o completadas) -->
            <div v-if="detalleOrden && ['aprobada','completada'].includes(detalleOrden.estado)"
              class="flex-shrink-0 px-6 py-4 border-t border-stone-800 bg-stone-950">
              <button @click="descargarExcel(detalleOrden.id)"
                class="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm transition-colors">
                <i class="fa-solid fa-file-excel" />
                Descargar Excel
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.drawer-fade-enter-active, .drawer-fade-leave-active { transition: opacity 0.2s ease; }
.drawer-fade-enter-from, .drawer-fade-leave-to { opacity: 0; }

.drawer-slide-enter-active, .drawer-slide-leave-active { transition: transform 0.25s ease; }
.drawer-slide-enter-from, .drawer-slide-leave-to { transform: translateX(100%); }
</style>
