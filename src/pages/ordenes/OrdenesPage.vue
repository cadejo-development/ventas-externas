<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api, { getSession } from '../../services/api.js'
import PageHeader from '../../components/PageHeader.vue'
import { useToast } from '../../composables/useToast.js'

const router  = useRouter()
const session = getSession()
const { push: toast } = useToast()

const ordenes = ref([])
const meta    = ref({ current_page: 1, last_page: 1, total: 0 })
const loading = ref(true)
const filtroEstado = ref('')
const busqueda     = ref('')
const fechaDesde   = ref('')
const fechaHasta   = ref('')
const page    = ref(1)

let debounceTimer = null

async function cargar(p = 1) {
  page.value = p; loading.value = true
  try {
    const { data } = await api.get('ordenes', {
      params: {
        estado:      filtroEstado.value || undefined,
        busqueda:    busqueda.value     || undefined,
        fecha_desde: fechaDesde.value   || undefined,
        fecha_hasta: fechaHasta.value   || undefined,
        page: p,
      }
    })
    ordenes.value = data.data; meta.value = data
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

function onBusqueda() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => cargar(1), 350)
}

function limpiarFiltros() {
  busqueda.value   = ''
  fechaDesde.value = ''
  fechaHasta.value = ''
  filtroEstado.value = ''
  cargar(1)
}

onMounted(() => cargar(1))

const paginasVisibles = computed(() => {
  const t = meta.value.last_page, c = meta.value.current_page
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  return [...new Set([1, t, c, c-1, c+1].filter(p => p >= 1 && p <= t))].sort((a,b)=>a-b)
})

const estadoOpts = [
  ['', 'Todos'], ['borrador', 'Borrador'], ['pendiente_aprobacion', 'Pendiente'],
  ['aprobada', 'Aprobada'], ['despachada', 'Despachada'], ['rechazada', 'Rechazada'], ['completada', 'Completada'],
]

function estadoBadge(e) {
  return {
    aprobada: 'badge-green', pendiente_aprobacion: 'badge-amber', borrador: 'badge-stone',
    rechazada: 'badge-red', completada: 'badge-blue', despachada: 'badge-purple',
  }[e] || 'badge-stone'
}

function fmt(n) { return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(n || 0) }

// ── Drawer de detalle ─────────────────────────────────────────────────────────
const drawer         = ref(false)
const detalleOrden   = ref(null)
const loadingDetalle = ref(false)
const savingAction   = ref('')

// Pagos
const pagos          = ref([])
const loadingPagos   = ref(false)
const showPagoForm   = ref(false)
const pagoArchivoRef = ref(null)
const pagoForm       = ref({
  fecha: new Date().toISOString().slice(0,10), forma_pago: 'transferencia',
  monto: '', comprobante: '', registrado_por: session?.nombre || '', notas: '',
  _archivo: null,
})

const PAGOS_DEMO = [
  { id: 'd1', fecha: '2026-06-10', forma_pago: 'transferencia', monto: 500.00, comprobante: 'TRF-20240610', comprobante_ruta: null, _demo: true },
  { id: 'd2', fecha: '2026-06-20', forma_pago: 'cheque',        monto: 300.00, comprobante: 'CHQ-001234',   comprobante_ruta: null, _demo: true },
]

async function verDetalle(id) {
  drawer.value         = true
  loadingDetalle.value = true
  detalleOrden.value   = null
  showPagoForm.value   = false
  pagos.value          = []
  try {
    const { data } = await api.get(`ordenes/${id}`)
    detalleOrden.value = data
    if (data.tipo_venta === 'credito') cargarPagos(id)
  } catch (e) { console.error(e) }
  finally { loadingDetalle.value = false }
}

function cerrarDrawer() { drawer.value = false }

async function cargarPagos(ordenId) {
  loadingPagos.value = true
  try {
    const { data } = await api.get(`ordenes/${ordenId}/pagos`)
    pagos.value = data.data ?? []
  } catch { pagos.value = [] }
  finally { loadingPagos.value = false }
}

function onPagoArchivoChange(e) {
  pagoForm.value._archivo = e.target.files[0] ?? null
}

async function guardarPago() {
  if (!pagoForm.value.monto) { toast('Ingresa el monto', 'error'); return }
  savingAction.value = 'pago'
  try {
    let payload
    if (pagoForm.value._archivo) {
      const fd = new FormData()
      fd.append('fecha',          pagoForm.value.fecha)
      fd.append('forma_pago',     pagoForm.value.forma_pago)
      fd.append('monto',          pagoForm.value.monto)
      fd.append('comprobante',    pagoForm.value.comprobante)
      fd.append('registrado_por', pagoForm.value.registrado_por)
      fd.append('notas',          pagoForm.value.notas)
      fd.append('archivo',        pagoForm.value._archivo)
      payload = fd
    } else {
      payload = { ...pagoForm.value }
      delete payload._archivo
    }
    await api.post(`ordenes/${detalleOrden.value.id}/pagos`, payload)
    toast('Pago registrado')
    showPagoForm.value = false
    pagoForm.value = { fecha: new Date().toISOString().slice(0,10), forma_pago: 'transferencia', monto: '', comprobante: '', registrado_por: session?.nombre || '', notas: '', _archivo: null }
    if (pagoArchivoRef.value) pagoArchivoRef.value.value = ''
    const { data } = await api.get(`ordenes/${detalleOrden.value.id}`)
    detalleOrden.value = data
    await cargarPagos(data.id)
    await cargar(page.value)
  } catch (e) { toast(e.response?.data?.message || 'Error al registrar pago', 'error') }
  finally { savingAction.value = '' }
}

async function verComprobante(pagoId) {
  try {
    const { data } = await api.get(`ordenes/${detalleOrden.value.id}/pagos/${pagoId}/comprobante`)
    window.open(data.url, '_blank')
  } catch { toast('Error al obtener comprobante', 'error') }
}

async function marcarDespachada() {
  savingAction.value = 'despachar'
  try {
    await api.patch(`ordenes/${detalleOrden.value.id}/despachar`, { despachada_por: session?.nombre })
    toast('Orden marcada como despachada')
    const { data } = await api.get(`ordenes/${detalleOrden.value.id}`)
    detalleOrden.value = data
    await cargar(page.value)
  } catch (e) { toast(e.response?.data?.message || 'Error', 'error') }
  finally { savingAction.value = '' }
}

async function marcarFacturado() {
  savingAction.value = 'facturar'
  try {
    await api.patch(`ordenes/${detalleOrden.value.id}/facturar`, { facturado_por: session?.nombre })
    toast('Orden marcada como facturada')
    const { data } = await api.get(`ordenes/${detalleOrden.value.id}`)
    detalleOrden.value = data
    await cargar(page.value)
  } catch (e) { toast(e.response?.data?.message || 'Error', 'error') }
  finally { savingAction.value = '' }
}

function descargarExcel(id) {
  const url = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/cadejo-ventas')
  window.open(`${url}/ordenes/${id}/export/excel`, '_blank')
}

const estadoLabel = (e) => ({
  borrador: 'Borrador', pendiente_aprobacion: 'Pendiente de aprobación',
  aprobada: 'Aprobada', rechazada: 'Rechazada', completada: 'Completada', despachada: 'Despachada',
}[e] || e)

const docLabel = (d) => d === 'ccf' ? 'CCF' : 'Consumidor Final'
const docBadge = (d) => d === 'ccf' ? 'badge-amber' : 'badge-stone'

const hayFiltros = computed(() => busqueda.value || fechaDesde.value || fechaHasta.value || filtroEstado.value)

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/cadejo-ventas'

// ── Modal de exportación ─────────────────────────────────────────────────────
const showExportModal  = ref(false)
const exportTipo       = ref('facturas')   // 'facturas' | 'clientes' | 'contabilidad'
const exportFechaDesde = ref('')
const exportFechaHasta = ref('')
const exportTipoDoc    = ref('')           // '' | 'ccf' | 'fcf'
const exportTipoVenta  = ref('')           // '' | 'credito' | 'contado'
const exportEstado     = ref('')           // '' | 'aprobada' | 'despachada' | 'completada'
const exportInactivos  = ref(false)

function abrirExportModal() {
  exportTipo.value       = 'facturas'
  exportFechaDesde.value = ''
  exportFechaHasta.value = ''
  exportTipoDoc.value    = ''
  exportTipoVenta.value  = ''
  exportEstado.value     = ''
  exportInactivos.value  = false
  showExportModal.value  = true
}

function descargarExportacion() {
  const p = new URLSearchParams()
  if (exportFechaDesde.value) p.set('fecha_desde', exportFechaDesde.value)
  if (exportFechaHasta.value) p.set('fecha_hasta', exportFechaHasta.value)

  if (exportTipo.value === 'facturas') {
    if (exportTipoDoc.value)   p.set('tipo_documento', exportTipoDoc.value)
    if (exportTipoVenta.value) p.set('tipo_venta', exportTipoVenta.value)
    if (exportEstado.value)    p.set('estado', exportEstado.value)
    window.open(`${API_BASE}/export/brilo-facturas?${p}`, '_blank')
  } else if (exportTipo.value === 'clientes') {
    if (exportInactivos.value) p.set('incluir_inactivos', '1')
    window.open(`${API_BASE}/export/brilo-clientes?${p}`, '_blank')
  } else {
    if (exportTipoDoc.value)   p.set('tipo_documento', exportTipoDoc.value)
    if (exportTipoVenta.value) p.set('tipo_venta', exportTipoVenta.value)
    if (exportEstado.value)    p.set('estado', exportEstado.value)
    window.open(`${API_BASE}/export/contabilidad-csv?${p}`, '_blank')
  }
  showExportModal.value = false
}
</script>

<template>
  <div>
    <PageHeader title="Órdenes de venta">
      <template #actions>
        <button @click="abrirExportModal" class="btn btn-secondary">
          <i class="fa-solid fa-download mr-1.5" />Exportar
        </button>

        <RouterLink to="/ordenes/nueva" class="btn btn-primary">
          <i class="fa-solid fa-plus mr-2" />Nueva orden
        </RouterLink>
      </template>
    </PageHeader>

    <!-- Filtros superiores -->
    <div class="flex flex-wrap gap-3 mb-4">
      <div class="relative flex-1 min-w-48 max-w-xs">
        <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 text-xs pointer-events-none" />
        <input v-model="busqueda" @input="onBusqueda" type="text" placeholder="Buscar cliente, NIT..."
          class="input pl-9 h-9 text-sm" />
      </div>

      <div class="flex items-center gap-1.5">
        <span class="text-xs text-stone-500">Desde</span>
        <input v-model="fechaDesde" @change="cargar(1)" type="date" class="input h-9 text-sm w-36" />
      </div>

      <div class="flex items-center gap-1.5">
        <span class="text-xs text-stone-500">Hasta</span>
        <input v-model="fechaHasta" @change="cargar(1)" type="date" class="input h-9 text-sm w-36" />
      </div>

      <button v-if="hayFiltros" @click="limpiarFiltros"
        class="text-xs text-stone-400 hover:text-red-400 transition-colors flex items-center gap-1.5">
        <i class="fa-solid fa-xmark" />Limpiar
      </button>
    </div>

    <!-- Filtros estado -->
    <div class="flex gap-1 bg-stone-800 rounded-lg p-1 mb-5 w-fit overflow-x-auto max-w-full">
      <button v-for="[val, label] in estadoOpts" :key="val"
        :class="['px-3 py-1.5 rounded text-xs font-medium transition whitespace-nowrap',
          filtroEstado === val ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-200']"
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
        <table class="w-full text-sm min-w-[900px]">
          <thead>
            <tr>
              <th class="px-3 py-2.5">#</th>
              <th class="px-3 py-2.5">Cliente</th>
              <th class="px-3 py-2.5">Doc.</th>
              <th class="px-3 py-2.5 text-right">Total</th>
              <th class="px-3 py-2.5 text-center">Estado</th>
              <th class="px-3 py-2.5">F. Solicitud</th>
              <th class="px-3 py-2.5">F. Factura</th>
              <th class="px-3 py-2.5">F. Entrega</th>
              <th class="px-3 py-2.5 text-center">Facturado</th>
              <th class="px-3 py-2.5 w-8" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in ordenes" :key="o.id"
              class="hover:bg-stone-800/40 transition-colors cursor-pointer"
              @click="verDetalle(o.id)">
              <td class="px-3 py-2.5 font-mono text-amber-300 text-xs">#{{ o.id }}</td>
              <td class="px-3 py-2.5">
                <div class="font-medium text-neutral-100">{{ o.cliente?.nombres || '—' }}</div>
                <div v-if="o.tipo_orden === 'autoconsumo'" class="text-[10px] text-orange-400/80 mt-0.5">
                  Autoconsumo{{ o.sub_ceco ? ` · ${o.sub_ceco}` : '' }}
                </div>
              </td>
              <td class="px-3 py-2.5">
                <span class="badge text-[10px]" :class="docBadge(o.tipo_documento)">{{ docLabel(o.tipo_documento) }}</span>
              </td>
              <td class="px-3 py-2.5 text-right tabular-nums text-emerald-400 font-semibold">{{ fmt(o.total) }}</td>
              <td class="px-3 py-2.5 text-center">
                <span class="badge" :class="estadoBadge(o.estado)">{{ estadoLabel(o.estado) }}</span>
              </td>
              <td class="px-3 py-2.5 text-stone-400 text-xs">{{ o.created_at?.slice(0, 10) }}</td>
              <td class="px-3 py-2.5 text-stone-400 text-xs">{{ o.fecha_facturacion || '—' }}</td>
              <td class="px-3 py-2.5 text-stone-400 text-xs">{{ o.fecha_entrega || '—' }}</td>
              <td class="px-3 py-2.5 text-center">
                <i v-if="o.facturado" class="fa-solid fa-circle-check text-emerald-400 text-xs" title="Facturada" />
                <span v-else class="text-stone-700 text-xs">—</span>
              </td>
              <td class="px-3 py-2.5 text-center">
                <i class="fa-solid fa-chevron-right text-xs text-stone-700" />
              </td>
            </tr>
            <tr v-if="!ordenes.length">
              <td colspan="10" class="px-4 py-16 text-center text-stone-500">
                <i class="fa-solid fa-file-invoice text-3xl text-stone-700 mb-3 block" />
                Sin órdenes{{ hayFiltros ? ' con esos filtros' : ' aún' }}
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
        <div class="absolute inset-0 bg-black/50" @click="cerrarDrawer" />

        <Transition name="drawer-slide">
          <div v-if="drawer"
            class="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-stone-950 border-l border-stone-800 shadow-2xl flex flex-col">

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

            <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              <template v-if="loadingDetalle">
                <div class="space-y-3 animate-pulse">
                  <div class="h-4 bg-stone-800 rounded w-3/4" />
                  <div class="h-4 bg-stone-800 rounded w-1/2" />
                  <div class="h-32 bg-stone-800 rounded mt-4" />
                </div>
              </template>

              <template v-else-if="detalleOrden">

                <!-- Acciones rápidas -->
                <div v-if="['aprobada','despachada'].includes(detalleOrden.estado)" class="flex gap-2 flex-wrap">
                  <button v-if="detalleOrden.estado === 'aprobada'"
                    @click="marcarDespachada" :disabled="savingAction === 'despachar'"
                    class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-purple-900/20 border border-purple-700/40 text-purple-300 hover:bg-purple-900/40 disabled:opacity-40 transition-all">
                    <i v-if="savingAction === 'despachar'" class="fa-solid fa-circle-notch fa-spin" />
                    <i v-else class="fa-solid fa-truck" />
                    Marcar despachada
                  </button>
                  <button v-if="!detalleOrden.facturado"
                    @click="marcarFacturado" :disabled="savingAction === 'facturar'"
                    class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-emerald-900/20 border border-emerald-700/40 text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-40 transition-all">
                    <i v-if="savingAction === 'facturar'" class="fa-solid fa-circle-notch fa-spin" />
                    <i v-else class="fa-solid fa-receipt" />
                    Marcar facturada
                  </button>
                  <div v-else
                    class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs bg-emerald-900/20 border border-emerald-700/30 text-emerald-400">
                    <i class="fa-solid fa-circle-check" />Facturada{{ detalleOrden.facturado_por ? ` · ${detalleOrden.facturado_por}` : '' }}
                  </div>
                </div>

                <!-- Datos generales -->
                <div class="grid grid-cols-2 gap-3">
                  <div class="bg-stone-900 rounded-lg px-4 py-3">
                    <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">Estado</p>
                    <span class="badge text-xs" :class="estadoBadge(detalleOrden.estado)">{{ estadoLabel(detalleOrden.estado) }}</span>
                  </div>
                  <div class="bg-stone-900 rounded-lg px-4 py-3">
                    <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">Tipo documento</p>
                    <span class="badge text-xs" :class="docBadge(detalleOrden.tipo_documento)">{{ docLabel(detalleOrden.tipo_documento) }}</span>
                  </div>
                  <div class="bg-stone-900 rounded-lg px-4 py-3">
                    <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">Tipo de venta</p>
                    <span class="badge text-xs" :class="detalleOrden.tipo_venta === 'credito' ? 'badge-blue' : 'badge-stone'">{{ detalleOrden.tipo_venta }}</span>
                  </div>
                  <div class="bg-stone-900 rounded-lg px-4 py-3">
                    <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">Plazo</p>
                    <p class="text-sm text-neutral-200">{{ detalleOrden.plazo_solicitado ? `${detalleOrden.plazo_solicitado} días` : 'Contado' }}</p>
                  </div>
                  <div class="bg-stone-900 rounded-lg px-4 py-3">
                    <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">F. Solicitud</p>
                    <p class="text-sm text-neutral-200">{{ detalleOrden.created_at?.slice(0,10) }}</p>
                  </div>
                  <div class="bg-stone-900 rounded-lg px-4 py-3">
                    <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">F. Facturación</p>
                    <p class="text-sm text-neutral-200">{{ detalleOrden.fecha_facturacion || '—' }}</p>
                  </div>
                  <div class="bg-stone-900 rounded-lg px-4 py-3">
                    <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">F. Entrega</p>
                    <p class="text-sm text-neutral-200">{{ detalleOrden.fecha_entrega || '—' }}</p>
                  </div>
                  <div v-if="detalleOrden.creado_por" class="bg-stone-900 rounded-lg px-4 py-3">
                    <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">Creado por</p>
                    <p class="text-sm text-neutral-200">{{ detalleOrden.creado_por }}</p>
                  </div>
                  <div v-if="detalleOrden.despachada_at" class="bg-stone-900 rounded-lg px-4 py-3 col-span-2">
                    <p class="text-[10px] text-stone-500 uppercase tracking-wide mb-1">Despachada</p>
                    <p class="text-sm text-purple-300">
                      {{ detalleOrden.despachada_at?.slice(0,10) }}
                      <span v-if="detalleOrden.despachada_por" class="text-stone-400"> · por {{ detalleOrden.despachada_por }}</span>
                    </p>
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

                <!-- ── Pagos (solo crédito) ────────────────────────────────── -->
                <div v-if="detalleOrden.tipo_venta === 'credito'">
                  <div class="flex items-center justify-between mb-2">
                    <h3 class="text-xs font-semibold text-stone-400 uppercase tracking-wide">
                      <i class="fa-solid fa-coins mr-1" />Pagos registrados
                    </h3>
                    <button v-if="['aprobada','despachada','completada'].includes(detalleOrden.estado)"
                      @click="showPagoForm = !showPagoForm"
                      class="text-xs text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors">
                      <i :class="showPagoForm ? 'fa-solid fa-xmark' : 'fa-solid fa-plus'" />
                      {{ showPagoForm ? 'Cancelar' : 'Registrar pago' }}
                    </button>
                  </div>

                  <Transition name="fade">
                    <div v-if="showPagoForm"
                      class="bg-stone-900/60 border border-stone-800 rounded-xl p-4 mb-3 space-y-3">
                      <div class="grid grid-cols-2 gap-3">
                        <div>
                          <label class="label text-xs">Fecha</label>
                          <input v-model="pagoForm.fecha" type="date" class="input text-sm h-9" />
                        </div>
                        <div>
                          <label class="label text-xs">Forma de pago</label>
                          <select v-model="pagoForm.forma_pago" class="select text-sm h-9">
                            <option value="efectivo">Efectivo</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="cheque">Cheque</option>
                            <option value="tarjeta">Tarjeta</option>
                            <option value="otro">Otro</option>
                          </select>
                        </div>
                        <div>
                          <label class="label text-xs">Monto ($)</label>
                          <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs">$</span>
                            <input v-model.number="pagoForm.monto" type="number" min="0.01" step="0.01"
                              class="input text-sm pl-6 h-9" placeholder="0.00" />
                          </div>
                        </div>
                        <div>
                          <label class="label text-xs">N° referencia</label>
                          <input v-model="pagoForm.comprobante" type="text" placeholder="N° ref..."
                            class="input text-sm h-9" />
                        </div>
                      </div>
                      <div>
                        <label class="label text-xs">Comprobante (PDF, imagen)</label>
                        <input ref="pagoArchivoRef" @change="onPagoArchivoChange" type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          class="block w-full text-xs text-stone-400
                            file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
                            file:text-xs file:font-semibold file:bg-stone-700 file:text-stone-200
                            hover:file:bg-stone-600 cursor-pointer" />
                      </div>
                      <button @click="guardarPago" :disabled="savingAction === 'pago'"
                        class="w-full py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                        <i v-if="savingAction === 'pago'" class="fa-solid fa-circle-notch fa-spin text-xs" />
                        <i v-else class="fa-solid fa-floppy-disk text-xs" />
                        Guardar pago
                      </button>
                    </div>
                  </Transition>

                  <div v-if="loadingPagos" class="text-center py-4 text-stone-500 text-xs">
                    <i class="fa-solid fa-circle-notch fa-spin mr-1" />Cargando pagos...
                  </div>
                  <div v-else class="rounded-xl border border-stone-800 overflow-hidden">
                    <table class="w-full text-xs">
                      <thead class="bg-stone-900">
                        <tr>
                          <th class="px-3 py-2 text-left text-stone-400">Fecha</th>
                          <th class="px-3 py-2 text-left text-stone-400">Forma</th>
                          <th class="px-3 py-2 text-right text-stone-400">Monto</th>
                          <th class="px-3 py-2 text-left text-stone-400">Ref.</th>
                          <th class="px-3 py-2 text-center text-stone-400">Doc.</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-stone-800/60">
                        <template v-if="pagos.length">
                          <tr v-for="p in pagos" :key="p.id" class="hover:bg-stone-900/40">
                            <td class="px-3 py-2 text-stone-300">{{ p.fecha?.slice(0,10) }}</td>
                            <td class="px-3 py-2 text-stone-300 capitalize">{{ p.forma_pago }}</td>
                            <td class="px-3 py-2 text-right text-emerald-400 font-semibold tabular-nums">{{ fmt(p.monto) }}</td>
                            <td class="px-3 py-2 text-stone-500">{{ p.comprobante || '—' }}</td>
                            <td class="px-3 py-2 text-center">
                              <button v-if="p.comprobante_ruta" @click="verComprobante(p.id)"
                                title="Ver comprobante"
                                class="w-6 h-6 rounded-md flex items-center justify-center mx-auto text-amber-400 hover:text-amber-300 hover:bg-stone-700 transition-colors">
                                <i class="fa-solid fa-file-arrow-down text-xs" />
                              </button>
                              <span v-else class="text-stone-700">—</span>
                            </td>
                          </tr>
                        </template>
                        <template v-else>
                          <tr v-for="p in PAGOS_DEMO" :key="p.id" class="hover:bg-stone-900/40 opacity-40 italic">
                            <td class="px-3 py-2 text-stone-400">{{ p.fecha }}</td>
                            <td class="px-3 py-2 text-stone-400 capitalize">{{ p.forma_pago }}</td>
                            <td class="px-3 py-2 text-right text-emerald-600 font-semibold tabular-nums">{{ fmt(p.monto) }}</td>
                            <td class="px-3 py-2 text-stone-600">{{ p.comprobante }}</td>
                            <td class="px-3 py-2 text-center text-stone-700">—</td>
                          </tr>
                          <tr>
                            <td colspan="5" class="px-3 py-1.5 text-center text-[10px] text-stone-700">
                              — datos de muestra —
                            </td>
                          </tr>
                        </template>
                      </tbody>
                    </table>
                  </div>
                </div>

              </template>
            </div>

            <div v-if="detalleOrden" class="flex-shrink-0 px-6 py-4 border-t border-stone-800 bg-stone-950">
              <button v-if="['aprobada','completada','despachada'].includes(detalleOrden.estado)"
                @click="descargarExcel(detalleOrden.id)"
                class="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm transition-colors">
                <i class="fa-solid fa-file-excel" />Descargar Excel
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <!-- ── Modal de exportación ──────────────────────────────────────────── -->
    <Transition name="drawer-fade">
      <div v-if="showExportModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showExportModal = false">
        <div class="absolute inset-0 bg-black/60" @click="showExportModal = false" />
        <div class="relative bg-stone-950 border border-stone-800 rounded-2xl shadow-2xl w-full max-w-md flex flex-col">

          <div class="flex items-center justify-between px-6 py-4 border-b border-stone-800">
            <h2 class="text-base font-semibold text-neutral-100">Exportar datos</h2>
            <button @click="showExportModal = false" class="text-stone-500 hover:text-stone-200 transition text-xl leading-none p-1">
              <i class="fa-solid fa-xmark" />
            </button>
          </div>

          <div class="px-6 py-5 space-y-5">

            <!-- Tipo de archivo -->
            <div>
              <label class="block text-xs text-stone-400 font-medium mb-2">Tipo de archivo</label>
              <div class="grid grid-cols-3 gap-2">
                <button v-for="[val, label] in [['facturas','Facturas Brilo'],['clientes','Clientes Brilo'],['contabilidad','CSV Contabilidad']]"
                  :key="val" type="button"
                  @click="exportTipo = val"
                  class="py-2.5 px-2 rounded-xl border text-xs font-medium transition text-center"
                  :class="exportTipo === val
                    ? 'bg-amber-600/20 border-amber-600 text-amber-300'
                    : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-600'">
                  {{ label }}
                </button>
              </div>
            </div>

            <!-- Rango de fechas (no aplica para clientes) -->
            <div v-if="exportTipo !== 'clientes'" class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-stone-400 font-medium mb-1.5">Fecha desde</label>
                <input v-model="exportFechaDesde" type="date" class="input h-9 text-sm" />
              </div>
              <div>
                <label class="block text-xs text-stone-400 font-medium mb-1.5">Fecha hasta</label>
                <input v-model="exportFechaHasta" type="date" class="input h-9 text-sm" />
              </div>
            </div>

            <!-- Filtros adicionales para facturas y contabilidad -->
            <div v-if="exportTipo !== 'clientes'" class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-xs text-stone-400 font-medium mb-1.5">Tipo doc.</label>
                <select v-model="exportTipoDoc" class="select h-9 text-sm">
                  <option value="">Todos</option>
                  <option value="ccf">CCF</option>
                  <option value="fcf">CF</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-stone-400 font-medium mb-1.5">Tipo venta</label>
                <select v-model="exportTipoVenta" class="select h-9 text-sm">
                  <option value="">Todos</option>
                  <option value="credito">Crédito</option>
                  <option value="contado">Contado</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-stone-400 font-medium mb-1.5">Estado</label>
                <select v-model="exportEstado" class="select h-9 text-sm">
                  <option value="">Todos</option>
                  <option value="aprobada">Aprobada</option>
                  <option value="despachada">Despachada</option>
                  <option value="completada">Completada</option>
                </select>
              </div>
            </div>

            <!-- Incluir inactivos (solo clientes) -->
            <div v-if="exportTipo === 'clientes'" class="flex items-center gap-2.5">
              <input id="chk-inactivos" type="checkbox" v-model="exportInactivos" class="accent-amber-500" />
              <label for="chk-inactivos" class="text-sm text-stone-300 cursor-pointer">Incluir clientes inactivos</label>
            </div>

          </div>

          <div class="px-6 py-4 border-t border-stone-800 flex justify-end gap-3">
            <button @click="showExportModal = false" class="btn btn-secondary">Cancelar</button>
            <button @click="descargarExportacion" class="btn btn-primary">
              <i class="fa-solid fa-download mr-1.5" />Descargar
            </button>
          </div>

        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.drawer-fade-enter-active, .drawer-fade-leave-active { transition: opacity 0.2s ease; }
.drawer-fade-enter-from, .drawer-fade-leave-to { opacity: 0; }
.drawer-slide-enter-active, .drawer-slide-leave-active { transition: transform 0.25s ease; }
.drawer-slide-enter-from, .drawer-slide-leave-to { transform: translateX(100%); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
