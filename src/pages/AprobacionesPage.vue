<script setup>
import { ref, onMounted } from 'vue'
import api, { getSession } from '../services/api.js'
import PageHeader from '../components/PageHeader.vue'

const session      = getSession()
const aprobaciones = ref([])
const loading      = ref(true)
const filtro       = ref('pendiente')
const resolviendo  = ref(null)

async function cargar() {
  loading.value = true
  try {
    const { data } = await api.get('aprobaciones', { params: { estado: filtro.value } })
    aprobaciones.value = data
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

onMounted(cargar)

function tipoBadge(tipo) {
  return {
    exceso_limite:     ['badge-amber', 'Exceso de límite'],
    cambio_credito:    ['badge-blue',  'Cambio a crédito'],
    modificacion_orden:['badge-stone', 'Modificación'],
  }[tipo] || ['badge-stone', tipo]
}

function fmt(n) { return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(n || 0) }

// ── Drawer de detalle + decisión ──────────────────────────────────────────────
const drawer          = ref(false)
const aprobSeleccionada = ref(null)
const detalleOrden    = ref(null)
const loadingOrden    = ref(false)
const notaResolucion  = ref('')

async function verDetalle(a) {
  aprobSeleccionada.value = a
  detalleOrden.value      = null
  notaResolucion.value    = ''
  drawer.value            = true

  if (a.orden?.id) {
    loadingOrden.value = true
    try {
      const { data } = await api.get(`ordenes/${a.orden.id}`)
      detalleOrden.value = data
    } catch (e) { console.error(e) }
    finally { loadingOrden.value = false }
  }
}

async function resolver(estado) {
  if (!aprobSeleccionada.value) return
  resolviendo.value = aprobSeleccionada.value.id
  try {
    await api.patch(`aprobaciones/${aprobSeleccionada.value.id}/resolver`, {
      estado,
      resuelto_por:    session?.nombre || 'Jefe de Ventas',
      nota_resolucion: notaResolucion.value || null,
    })
    drawer.value = false
    await cargar()
  } catch (e) { alert(e.response?.data?.message || 'Error') }
  finally { resolviendo.value = null }
}

function estadoBadge(e) {
  return { aprobada: 'badge-green', pendiente_aprobacion: 'badge-amber', borrador: 'badge-stone', rechazada: 'badge-red', completada: 'badge-blue' }[e] || 'badge-stone'
}
</script>

<template>
  <div>
    <PageHeader title="Aprobaciones" subtitle="Solicitudes que requieren autorización del jefe de ventas" />

    <!-- Tabs -->
    <div class="flex gap-1 bg-stone-800 rounded-lg p-1 mb-5 w-fit">
      <button v-for="e in [['pendiente','Pendientes'],['aprobado','Aprobadas'],['rechazado','Rechazadas']]" :key="e[0]"
        :class="['px-3 py-1.5 rounded text-xs font-medium transition', filtro === e[0] ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-200']"
        @click="filtro = e[0]; cargar()">{{ e[1] }}</button>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="card animate-pulse">
        <div class="h-3 bg-stone-800 rounded w-1/3 mb-2" /><div class="h-3 bg-stone-700 rounded w-2/3" />
      </div>
    </div>

    <div v-else-if="!aprobaciones.length" class="card text-center py-16 text-stone-500">
      <i class="fa-solid fa-circle-check text-3xl text-stone-700 mb-3 block" />
      Sin solicitudes {{ filtro === 'pendiente' ? 'pendientes' : filtro + 's' }}
    </div>

    <div v-else class="space-y-3">
      <div v-for="a in aprobaciones" :key="a.id"
        class="card hover:border-stone-600/60 transition-colors cursor-pointer"
        @click="verDetalle(a)">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1.5">
              <span class="badge" :class="tipoBadge(a.tipo)[0]">{{ tipoBadge(a.tipo)[1] }}</span>
              <span class="text-xs text-stone-500">{{ a.created_at?.slice(0, 10) }}</span>
            </div>
            <p class="text-sm text-stone-300 mb-2">{{ a.detalle }}</p>
            <div class="text-xs text-stone-500 flex flex-wrap gap-3">
              <span v-if="a.orden"><i class="fa-solid fa-file-invoice mr-1" />Orden #{{ a.orden.id }} — {{ fmt(a.orden.total) }}</span>
              <span v-if="a.cliente"><i class="fa-solid fa-user mr-1" />{{ a.cliente.nombres }}</span>
              <span><i class="fa-solid fa-person-circle-question mr-1" />Solicitado por: {{ a.solicitado_por || '—' }}</span>
            </div>
            <div v-if="a.resuelto_por" class="text-xs text-stone-500 mt-1">
              <i class="fa-solid fa-check-circle mr-1" />Resuelto por {{ a.resuelto_por }}
              <span v-if="a.nota_resolucion">: {{ a.nota_resolucion }}</span>
            </div>
          </div>

          <!-- Estado o flecha -->
          <div class="flex-shrink-0 flex items-center gap-2">
            <span v-if="a.estado !== 'pendiente'" class="badge"
              :class="{ 'badge-green': a.estado==='aprobado', 'badge-red': a.estado==='rechazado' }">
              {{ a.estado }}
            </span>
            <span v-else class="text-xs text-amber-400/70 flex items-center gap-1">
              Ver detalle <i class="fa-solid fa-chevron-right text-[10px]" />
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Drawer: detalle + decisión ────────────────────────────────────────── -->
    <Transition name="drawer-fade">
      <div v-if="drawer" class="fixed inset-0 z-50 flex" @click.self="drawer = false">
        <div class="absolute inset-0 bg-black/50" @click="drawer = false" />

        <Transition name="drawer-slide">
          <div v-if="drawer"
            class="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-stone-950 border-l border-stone-800 shadow-2xl flex flex-col">

            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-stone-800 flex-shrink-0">
              <div>
                <h2 class="text-base font-semibold text-neutral-100">Revisar solicitud</h2>
                <p v-if="aprobSeleccionada" class="text-xs text-stone-400 mt-0.5">
                  <span class="badge mr-1" :class="tipoBadge(aprobSeleccionada.tipo)[0]">{{ tipoBadge(aprobSeleccionada.tipo)[1] }}</span>
                  {{ aprobSeleccionada.cliente?.nombres }}
                </p>
              </div>
              <button @click="drawer = false" class="text-stone-500 hover:text-stone-200 transition text-xl p-1">
                <i class="fa-solid fa-xmark" />
              </button>
            </div>

            <!-- Contenido scrollable -->
            <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              <!-- Detalle de la solicitud -->
              <div class="bg-stone-900/60 rounded-lg px-4 py-3 border border-stone-800">
                <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">Motivo de solicitud</p>
                <p class="text-sm text-stone-200">{{ aprobSeleccionada?.detalle }}</p>
                <div class="text-xs text-stone-500 flex flex-wrap gap-3 mt-2">
                  <span><i class="fa-solid fa-person-circle-question mr-1" />{{ aprobSeleccionada?.solicitado_por }}</span>
                  <span><i class="fa-solid fa-calendar mr-1" />{{ aprobSeleccionada?.created_at?.slice(0,10) }}</span>
                </div>
              </div>

              <!-- Detalle de la orden -->
              <template v-if="aprobSeleccionada?.orden">
                <h3 class="text-xs font-semibold text-stone-400 uppercase tracking-wide">
                  <i class="fa-solid fa-file-invoice mr-1" />Orden #{{ aprobSeleccionada.orden.id }}
                </h3>

                <div v-if="loadingOrden" class="space-y-2 animate-pulse">
                  <div class="h-3 bg-stone-800 rounded w-3/4" />
                  <div class="h-24 bg-stone-800 rounded" />
                </div>

                <template v-else-if="detalleOrden">
                  <!-- Info orden -->
                  <div class="grid grid-cols-2 gap-3">
                    <div class="bg-stone-900 rounded-lg px-4 py-3">
                      <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">Estado</p>
                      <span class="badge text-xs" :class="estadoBadge(detalleOrden.estado)">
                        {{ detalleOrden.estado.replace('_',' ') }}
                      </span>
                    </div>
                    <div class="bg-stone-900 rounded-lg px-4 py-3">
                      <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">Tipo / Plazo</p>
                      <p class="text-sm text-neutral-200">
                        {{ detalleOrden.tipo_venta }}
                        <span v-if="detalleOrden.plazo_solicitado" class="text-stone-500"> · {{ detalleOrden.plazo_solicitado }} días</span>
                      </p>
                    </div>
                    <div class="bg-stone-900 rounded-lg px-4 py-3 col-span-2">
                      <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">Cliente</p>
                      <p class="text-sm text-neutral-200">{{ detalleOrden.cliente?.nombres }}</p>
                      <p v-if="detalleOrden.cliente?.limite_credito > 0" class="text-xs text-stone-500 mt-0.5">
                        Límite crédito: {{ fmt(detalleOrden.cliente.limite_credito) }} · Plazo estándar: {{ detalleOrden.cliente.plazo_credito }} días
                      </p>
                    </div>
                  </div>

                  <!-- Notas -->
                  <div v-if="detalleOrden.notas" class="bg-amber-950/30 border border-amber-800/30 rounded-lg px-4 py-3">
                    <p class="text-[10px] text-amber-500 uppercase tracking-wide mb-1"><i class="fa-solid fa-note-sticky mr-1" />Notas del vendedor</p>
                    <p class="text-sm text-amber-200/80">{{ detalleOrden.notas }}</p>
                  </div>

                  <!-- Productos -->
                  <div>
                    <h4 class="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
                      Productos ({{ detalleOrden.items?.length }})
                    </h4>
                    <div class="rounded-lg overflow-hidden border border-stone-800">
                      <table class="w-full text-xs">
                        <thead class="bg-stone-900">
                          <tr>
                            <th class="px-3 py-2 text-left text-stone-400 font-medium">Producto</th>
                            <th class="px-3 py-2 text-center text-stone-400 font-medium">Cant.</th>
                            <th class="px-3 py-2 text-right text-stone-400 font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-stone-800">
                          <tr v-for="item in detalleOrden.items" :key="item.id">
                            <td class="px-3 py-2 text-neutral-200">{{ item.nombre_producto }}</td>
                            <td class="px-3 py-2 text-center tabular-nums text-stone-300">{{ item.cantidad }}</td>
                            <td class="px-3 py-2 text-right tabular-nums font-semibold text-emerald-400">{{ fmt(item.total) }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <!-- Totales -->
                  <div class="bg-stone-900 rounded-lg overflow-hidden border border-stone-800">
                    <div class="flex justify-between px-4 py-2 text-xs border-b border-stone-800">
                      <span class="text-stone-400">Subtotal</span>
                      <span class="tabular-nums text-neutral-300">{{ fmt(detalleOrden.subtotal) }}</span>
                    </div>
                    <div class="flex justify-between px-4 py-2 text-xs border-b border-stone-800">
                      <span class="text-stone-400">IVA (13%)</span>
                      <span class="tabular-nums text-amber-400/80">{{ fmt(detalleOrden.total_iva) }}</span>
                    </div>
                    <div class="flex justify-between px-4 py-3 font-bold">
                      <span class="text-neutral-100">Total</span>
                      <span class="tabular-nums text-emerald-400 text-base">{{ fmt(detalleOrden.total) }}</span>
                    </div>
                  </div>
                </template>
              </template>

              <!-- Nota de resolución -->
              <div v-if="aprobSeleccionada?.estado === 'pendiente'">
                <label class="block text-xs text-stone-400 mb-1">Nota de resolución <span class="text-stone-600">(opcional)</span></label>
                <textarea v-model="notaResolucion" rows="2"
                  class="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500 resize-none"
                  placeholder="Ej: Aprobado por excepción de cliente estratégico…" />
              </div>
            </div>

            <!-- Botones de decisión -->
            <div v-if="aprobSeleccionada?.estado === 'pendiente' && session?.rol === 'jefe_ventas'"
              class="flex gap-3 px-6 py-4 border-t border-stone-800 bg-stone-950 flex-shrink-0">
              <button @click="resolver('rechazado')" :disabled="!!resolviendo"
                class="flex-1 btn btn-secondary text-red-400 hover:text-red-300 hover:border-red-500/50 font-semibold">
                <i class="fa-solid fa-xmark mr-2" />Rechazar
              </button>
              <button @click="resolver('aprobado')" :disabled="!!resolviendo"
                class="flex-1 btn bg-green-700 hover:bg-green-600 text-white font-bold">
                <i v-if="resolviendo" class="fa-solid fa-circle-notch fa-spin mr-2" />
                <i v-else class="fa-solid fa-check mr-2" />Aprobar
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
