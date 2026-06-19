<script setup>
import { ref, computed, onMounted } from 'vue'
import api, { getSession } from '../services/api.js'
import { useToast } from '../composables/useToast.js'

const session       = getSession()
const { push: toast } = useToast()
const devoluciones  = ref([])
const loading       = ref(true)
const filtroEstado  = ref('pendiente')
const filtroTipo    = ref('')

const drawer        = ref(false)
const selected      = ref(null)
const detalleData   = ref(null)
const loadingDetalle = ref(false)
const resolviendo   = ref(null)
const notaRes       = ref('')

// ── Nueva devolución ─────────────────────────────────────────────────────────
const modoCrear    = ref(false)
const saving       = ref(false)
const allClientes  = ref([])
const productos    = ref([])
const clienteQuery = ref('')
const showDropdown = ref(false)

const MOTIVOS = [
  'Producto en mal estado',
  'Error en pedido',
  'Producto no solicitado',
  'Producto vencido',
  'Daño en transporte',
  'Otro',
]

const nuevaForm = ref({
  cliente_id: null, orden_id: null, tipo: 'devolucion',
  motivo: '', notas: '', items: [],
})

const clientesFiltrados = computed(() => {
  if (!clienteQuery.value.trim()) return []
  const s = clienteQuery.value.toLowerCase()
  return allClientes.value
    .filter(c => c.nombres.toLowerCase().includes(s) || (c.nom_comercial || '').toLowerCase().includes(s))
    .slice(0, 10)
})

function seleccionarCliente(c) {
  nuevaForm.value.cliente_id = c.id
  clienteQuery.value  = c.nombres
  showDropdown.value  = false
}

function addItem() {
  nuevaForm.value.items.push({ producto_id: null, cantidad: 1, precio_unitario: 0, motivo_item: '' })
}

function removeItem(idx) { nuevaForm.value.items.splice(idx, 1) }

function onProductoChangeNueva(idx) {
  const item = nuevaForm.value.items[idx]
  const prod = productos.value.find(p => p.id == item.producto_id)
  if (!prod) return
  item.precio_unitario = prod.precio || 0
}

const subtotalNueva = computed(() =>
  nuevaForm.value.items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
)

async function guardarDevolucion() {
  if (!nuevaForm.value.cliente_id) { toast('Selecciona un cliente', 'error'); return }
  if (!nuevaForm.value.items.length) { toast('Agrega al menos un producto', 'error'); return }
  saving.value = true
  try {
    await api.post('devoluciones', {
      ...nuevaForm.value,
      creado_por: session?.nombre,
      items: nuevaForm.value.items.map(i => ({
        producto_id: i.producto_id, cantidad: i.cantidad, precio_unitario: i.precio_unitario, motivo_item: i.motivo_item,
      }))
    })
    toast('Devolución registrada correctamente')
    modoCrear.value = false
    nuevaForm.value = { cliente_id: null, orden_id: null, tipo: 'devolucion', motivo: '', notas: '', items: [] }
    clienteQuery.value = ''
    await cargar()
  } catch (e) {
    toast(e.response?.data?.message || 'Error al guardar', 'error')
  } finally { saving.value = false }
}

// ── Dummy data ────────────────────────────────────────────────────────────────
const DUMMY = [
  {
    id: 1001, orden_id: 38, tipo: 'devolucion', estado: 'pendiente', motivo: 'Producto en mal estado',
    total: 52.00, creado_por: 'Carlos López', aprobado_por: null, aprobado_at: null,
    created_at: '2026-06-15T10:22:00',
    cliente: { id: 3, nombres: 'El Barón Restaurante', nom_comercial: 'El Barón' },
    items: [
      { id: 1, producto_id: 2, nombre_producto: 'Cerveza Amber Ale 330ml', cantidad: 12, precio_unitario: 2.50, exento: false, subtotal: 30.00, iva: 3.90, total: 33.90, motivo_item: 'Botellas rotas en envío' },
      { id: 2, producto_id: 5, nombre_producto: 'Cerveza Stout 500ml', cantidad: 4, precio_unitario: 3.50, exento: false, subtotal: 14.00, iva: 1.82, total: 15.82, motivo_item: '' },
    ],
  },
  {
    id: 1002, orden_id: 41, tipo: 'cambio', estado: 'pendiente', motivo: 'Error en pedido',
    total: 28.25, creado_por: 'Ana García', aprobado_por: null, aprobado_at: null,
    created_at: '2026-06-16T08:45:00',
    cliente: { id: 5, nombres: 'Restaurante La Cúpula', nom_comercial: 'La Cúpula' },
    items: [
      { id: 3, producto_id: 8, nombre_producto: 'IPA 330ml', cantidad: 10, precio_unitario: 2.50, exento: false, subtotal: 25.00, iva: 3.25, total: 28.25, motivo_item: 'Se entregó IPA en lugar de Lager solicitada' },
    ],
  },
  {
    id: 1003, orden_id: 29, tipo: 'devolucion', estado: 'aprobada', motivo: 'Producto vencido',
    total: 113.00, creado_por: 'Carlos López', aprobado_por: 'rodrigo', aprobado_at: '2026-06-10T14:30:00',
    created_at: '2026-06-09T16:00:00',
    cliente: { id: 2, nombres: 'Quality Restaurant Group', nom_comercial: 'Quality' },
    items: [
      { id: 4, producto_id: 3, nombre_producto: 'Barril 50L Amber Ale', cantidad: 1, precio_unitario: 100.00, exento: false, subtotal: 100.00, iva: 13.00, total: 113.00, motivo_item: 'Fecha de vencimiento ya expirada al momento de entrega' },
    ],
  },
  {
    id: 1004, orden_id: 35, tipo: 'cambio', estado: 'rechazada', motivo: 'Daño en transporte',
    total: 45.20, creado_por: 'Ana García', aprobado_por: 'rodrigo', aprobado_at: '2026-06-12T09:15:00',
    created_at: '2026-06-11T11:30:00',
    cliente: { id: 7, nombres: 'Pedidos Ya El Salvador', nom_comercial: 'Pedidos Ya' },
    items: [
      { id: 5, producto_id: 4, nombre_producto: 'Cerveza Lager 330ml', cantidad: 16, precio_unitario: 2.50, exento: false, subtotal: 40.00, iva: 5.20, total: 45.20, motivo_item: '' },
    ],
  },
]

// ── Listado ──────────────────────────────────────────────────────────────────
async function cargar() {
  loading.value = true
  try {
    const params = {}
    if (filtroEstado.value) params.estado = filtroEstado.value
    const { data } = await api.get('devoluciones', { params })
    const reales = data.data || data
    if (reales.length) {
      devoluciones.value = reales
    } else {
      // Filtrar dummy según filtro activo
      devoluciones.value = filtroEstado.value
        ? DUMMY.filter(d => d.estado === filtroEstado.value)
        : DUMMY
    }
  } catch (e) {
    // Si la API falla, mostrar dummy igualmente
    devoluciones.value = filtroEstado.value
      ? DUMMY.filter(d => d.estado === filtroEstado.value)
      : DUMMY
  }
  finally { loading.value = false }
}

async function verDetalle(d) {
  selected.value    = d
  detalleData.value = null
  notaRes.value     = ''
  drawer.value      = true
  loadingDetalle.value = true
  try {
    const { data } = await api.get(`devoluciones/${d.id}`)
    detalleData.value = data
  } catch (e) {
    // Si es un registro dummy (id >= 1000), servir desde DUMMY local
    const dummy = DUMMY.find(x => x.id === d.id)
    if (dummy) detalleData.value = { ...dummy, orden: dummy.orden_id ? { id: dummy.orden_id, total: dummy.total, estado: 'completada' } : null }
    else console.error(e)
  }
  finally { loadingDetalle.value = false }
}

async function resolver(estado) {
  if (!selected.value) return
  resolviendo.value = estado
  try {
    await api.patch(`devoluciones/${selected.value.id}/estado`, {
      estado, aprobado_por: session?.nombre, nota_resolucion: notaRes.value,
    })
    toast(estado === 'aprobada' ? 'Devolución aprobada' : 'Devolución rechazada', estado === 'aprobada' ? 'success' : 'error')
    drawer.value = false
    await cargar()
  } catch (e) {
    toast(e.response?.data?.message || 'Error al resolver', 'error')
  } finally { resolviendo.value = null }
}

function estadoBadge(e) {
  return {
    pendiente: ['badge-amber',  'Pendiente'],
    aprobada:  ['badge-green',  'Aprobada'],
    rechazada: ['badge-red',    'Rechazada'],
  }[e] || ['badge-stone', e]
}

function tipoBadge(t) {
  return {
    devolucion: ['badge-orange', 'Devolución'],
    cambio:     ['badge-blue',   'Cambio'],
  }[t] || ['badge-stone', t]
}

function fmt(n) {
  return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(n || 0)
}

const productosPorBodega = computed(() => {
  const g = {}
  for (const p of productos.value) {
    const k = p.bodega || 'Otros'
    if (!g[k]) g[k] = []
    g[k].push(p)
  }
  return g
})

onMounted(async () => {
  await cargar()
  try {
    const [rc, rp] = await Promise.all([
      api.get('clientes', { params: { page: 1 } }),
      api.get('productos'),
    ])
    allClientes.value = rc.data.data || []
    productos.value   = rp.data || []
    const totalPags = rc.data.last_page || 1
    if (totalPags > 1) {
      const rest = await Promise.all(
        Array.from({ length: totalPags - 1 }, (_, i) => api.get('clientes', { params: { page: i + 2 } }))
      )
      rest.forEach(r => { allClientes.value.push(...(r.data.data || [])) })
    }
  } catch { /* silencioso */ }
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-neutral-100">Cambios y Devoluciones</h1>
        <p class="text-xs text-stone-500 mt-0.5">Gestión de devoluciones y cambios de productos</p>
      </div>
      <button @click="modoCrear = !modoCrear" class="btn btn-primary btn-sm">
        <i :class="modoCrear ? 'fa-solid fa-xmark' : 'fa-solid fa-plus'" />
        {{ modoCrear ? 'Cancelar' : 'Nueva devolución' }}
      </button>
    </div>

    <!-- ── Formulario nueva devolución ──────────────────────────────────────── -->
    <Transition name="fade">
      <div v-if="modoCrear" class="card mb-5 animate-fade-in">
        <div class="section-title mb-4"><i class="fa-solid fa-rotate-left text-amber-500/60" />Nueva solicitud</div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <!-- Cliente -->
          <div>
            <label class="label">Cliente *</label>
            <div class="relative">
              <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 text-xs pointer-events-none" />
              <input v-model="clienteQuery" @input="showDropdown = true" @focus="showDropdown = clienteQuery.length > 0"
                type="text" placeholder="Buscar cliente..." class="input pl-9" />
              <div v-if="showDropdown && clientesFiltrados.length"
                class="absolute z-50 w-full mt-1 bg-stone-900 border border-stone-700 rounded-xl shadow-xl overflow-hidden">
                <div class="max-h-48 overflow-y-auto">
                  <button v-for="c in clientesFiltrados" :key="c.id" type="button"
                    @click="seleccionarCliente(c)"
                    class="w-full px-4 py-2.5 text-left text-sm hover:bg-amber-500/10 text-neutral-200 hover:text-amber-300 transition-colors">
                    {{ c.nombres }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Tipo -->
          <div>
            <label class="label">Tipo</label>
            <div class="flex gap-2">
              <button type="button" @click="nuevaForm.tipo = 'devolucion'"
                class="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all"
                :class="nuevaForm.tipo === 'devolucion'
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                  : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-600'">
                <i class="fa-solid fa-rotate-left mr-1.5" />Devolución
              </button>
              <button type="button" @click="nuevaForm.tipo = 'cambio'"
                class="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all"
                :class="nuevaForm.tipo === 'cambio'
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                  : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-600'">
                <i class="fa-solid fa-arrows-rotate mr-1.5" />Cambio
              </button>
            </div>
          </div>

          <!-- Referencia orden (opcional) -->
          <div>
            <label class="label">N° Orden de referencia <span class="text-stone-600 font-normal">(opcional)</span></label>
            <input v-model.number="nuevaForm.orden_id" type="number" min="1" placeholder="Ej: 42" class="input" />
          </div>

          <!-- Motivo general -->
          <div>
            <label class="label">Motivo</label>
            <select v-model="nuevaForm.motivo" class="select">
              <option value="">— Seleccionar —</option>
              <option v-for="m in MOTIVOS" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>

          <!-- Notas -->
          <div class="md:col-span-2">
            <label class="label">Notas adicionales</label>
            <input v-model="nuevaForm.notas" type="text" placeholder="Opcional..." class="input" />
          </div>
        </div>

        <!-- Items -->
        <div class="border-t border-stone-800/60 pt-4">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-semibold text-stone-300">Productos a devolver</span>
            <button type="button" @click="addItem" class="btn btn-secondary btn-sm">
              <i class="fa-solid fa-plus" />Agregar
            </button>
          </div>

          <div v-if="!nuevaForm.items.length"
            class="text-center py-8 text-stone-500 border-2 border-dashed border-stone-800 rounded-xl">
            <i class="fa-solid fa-box-open text-2xl mb-2 block opacity-30" />
            <p class="text-sm">Agrega los productos</p>
          </div>

          <div class="space-y-2">
            <div v-for="(item, idx) in nuevaForm.items" :key="idx"
              class="flex gap-2 items-start bg-stone-800/30 border border-stone-800/60 rounded-xl p-3">
              <div class="flex-1 min-w-0">
                <label class="label">Producto</label>
                <select v-model="item.producto_id" @change="onProductoChangeNueva(idx)" class="select text-sm">
                  <option :value="null">— Seleccionar —</option>
                  <optgroup v-for="(prods, bodega) in productosPorBodega" :key="bodega" :label="bodega">
                    <option v-for="p in prods" :key="p.id" :value="p.id">{{ p.nombre }}</option>
                  </optgroup>
                </select>
              </div>
              <div class="w-24 flex-shrink-0">
                <label class="label">Cantidad</label>
                <input v-model.number="item.cantidad" type="number" min="0.01" step="0.01" class="input text-sm text-center" />
              </div>
              <div class="w-28 flex-shrink-0">
                <label class="label">Precio unit.</label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs">$</span>
                  <input v-model.number="item.precio_unitario" type="number" min="0" step="0.01" class="input text-sm pl-6 text-right" />
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <label class="label">Motivo item</label>
                <input v-model="item.motivo_item" type="text" placeholder="Opcional..." class="input text-sm" />
              </div>
              <button type="button" @click="removeItem(idx)"
                class="mt-6 w-7 h-7 rounded-lg text-stone-700 hover:text-red-400 hover:bg-red-900/20 transition-all flex items-center justify-center flex-shrink-0">
                <i class="fa-solid fa-xmark text-xs" />
              </button>
            </div>
          </div>

          <div v-if="nuevaForm.items.length" class="mt-3 flex justify-end">
            <div class="text-sm text-stone-400">Total estimado: <span class="font-bold text-amber-400 tabular-nums">{{ fmt(subtotalNueva) }}</span></div>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t border-stone-800/60 mt-4">
          <button type="button" @click="modoCrear = false" class="btn btn-secondary btn-sm">Cancelar</button>
          <button type="button" @click="guardarDevolucion" :disabled="saving" class="btn btn-primary btn-sm">
            <i v-if="saving" class="fa-solid fa-circle-notch fa-spin" />
            <i v-else class="fa-solid fa-floppy-disk" />
            {{ saving ? 'Guardando...' : 'Registrar' }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- ── Filtros ────────────────────────────────────────────────────────── -->
    <div class="flex flex-wrap gap-2 mb-4">
      <button v-for="e in [['', 'Todos'], ['pendiente', 'Pendientes'], ['aprobada', 'Aprobadas'], ['rechazada', 'Rechazadas']]"
        :key="e[0]" @click="filtroEstado = e[0]; cargar()"
        class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
        :class="filtroEstado === e[0]
          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
          : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-600'">
        {{ e[1] }}
      </button>
    </div>

    <!-- ── Tabla ─────────────────────────────────────────────────────────── -->
    <div class="card p-0 overflow-hidden">
      <div v-if="loading" class="flex items-center justify-center py-20 text-stone-500">
        <i class="fa-solid fa-circle-notch fa-spin text-2xl mr-3" />Cargando...
      </div>
      <div v-else-if="!devoluciones.length" class="text-center py-20 text-stone-500">
        <i class="fa-solid fa-box-open text-4xl mb-3 block opacity-20" />
        <p>No hay devoluciones</p>
      </div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-stone-800/60">
            <th class="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500">#</th>
            <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500">Cliente</th>
            <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500">Tipo</th>
            <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500">Motivo</th>
            <th class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-stone-500">Total</th>
            <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500">Estado</th>
            <th class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500">Fecha</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-stone-800/40">
          <tr v-for="d in devoluciones" :key="d.id"
            class="hover:bg-stone-800/20 transition-colors cursor-pointer group"
            @click="verDetalle(d)">
            <td class="px-5 py-3.5 text-stone-400 tabular-nums text-xs">#{{ d.id }}</td>
            <td class="px-4 py-3.5">
              <div class="font-medium text-neutral-200">{{ d.cliente?.nombres || '—' }}</div>
              <div v-if="d.orden_id" class="text-xs text-stone-500">Orden #{{ d.orden_id }}</div>
            </td>
            <td class="px-4 py-3.5">
              <span :class="tipoBadge(d.tipo)[0]" class="badge">{{ tipoBadge(d.tipo)[1] }}</span>
            </td>
            <td class="px-4 py-3.5 text-stone-400 text-xs max-w-[200px] truncate">{{ d.motivo || '—' }}</td>
            <td class="px-4 py-3.5 text-right font-semibold tabular-nums text-amber-400">{{ fmt(d.total) }}</td>
            <td class="px-4 py-3.5">
              <span :class="estadoBadge(d.estado)[0]" class="badge">{{ estadoBadge(d.estado)[1] }}</span>
            </td>
            <td class="px-4 py-3.5 text-xs text-stone-500">{{ d.created_at?.slice(0, 10) }}</td>
            <td class="px-4 py-3.5 text-right">
              <i class="fa-solid fa-chevron-right text-xs text-stone-700 group-hover:text-amber-500 transition-colors" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── Drawer Detalle ──────────────────────────────────────────────────── -->
    <Transition name="fade">
      <div v-if="drawer" class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" @click="drawer = false" />
    </Transition>
    <Transition name="slide-right">
      <aside v-if="drawer" class="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-stone-950 border-l border-stone-800 flex flex-col shadow-2xl">
        <div class="flex items-center gap-3 px-6 py-4 border-b border-stone-800/60">
          <button @click="drawer = false" class="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-400 transition-colors">
            <i class="fa-solid fa-xmark text-sm" />
          </button>
          <div>
            <h2 class="font-semibold text-neutral-100">Devolución #{{ selected?.id }}</h2>
            <p class="text-xs text-stone-500">{{ selected?.cliente?.nombres }}</p>
          </div>
          <span v-if="selected" :class="estadoBadge(selected.estado)[0]" class="badge ml-auto">
            {{ estadoBadge(selected.estado)[1] }}
          </span>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-5">
          <div v-if="loadingDetalle" class="flex items-center justify-center py-10 text-stone-500">
            <i class="fa-solid fa-circle-notch fa-spin mr-2" />Cargando...
          </div>

          <template v-else-if="detalleData">
            <!-- Info general -->
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div class="bg-stone-900/60 rounded-xl p-3">
                <p class="text-stone-500 text-xs mb-1">Tipo</p>
                <span :class="tipoBadge(detalleData.tipo)[0]" class="badge">{{ tipoBadge(detalleData.tipo)[1] }}</span>
              </div>
              <div class="bg-stone-900/60 rounded-xl p-3">
                <p class="text-stone-500 text-xs mb-1">Total</p>
                <p class="font-bold text-amber-400 tabular-nums">{{ fmt(detalleData.total) }}</p>
              </div>
              <div v-if="detalleData.motivo" class="col-span-2 bg-stone-900/60 rounded-xl p-3">
                <p class="text-stone-500 text-xs mb-1">Motivo</p>
                <p class="text-neutral-200">{{ detalleData.motivo }}</p>
              </div>
              <div v-if="detalleData.orden" class="bg-stone-900/60 rounded-xl p-3">
                <p class="text-stone-500 text-xs mb-1">Orden referenciada</p>
                <p class="text-neutral-200">#{{ detalleData.orden.id }} — {{ fmt(detalleData.orden.total) }}</p>
              </div>
              <div class="bg-stone-900/60 rounded-xl p-3">
                <p class="text-stone-500 text-xs mb-1">Creado por</p>
                <p class="text-neutral-200">{{ detalleData.creado_por || '—' }}</p>
              </div>
            </div>

            <!-- Items -->
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Productos</p>
              <div class="rounded-xl border border-stone-800/60 overflow-hidden">
                <table class="w-full text-xs">
                  <thead>
                    <tr class="border-b border-stone-800/60 bg-stone-900/40">
                      <th class="px-3 py-2 text-left text-stone-500">Producto</th>
                      <th class="px-3 py-2 text-center text-stone-500">Cant.</th>
                      <th class="px-3 py-2 text-right text-stone-500">Total</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-stone-800/40">
                    <tr v-for="i in detalleData.items" :key="i.id" class="hover:bg-stone-800/20">
                      <td class="px-3 py-2.5">
                        <div class="text-neutral-200">{{ i.nombre_producto }}</div>
                        <div v-if="i.motivo_item" class="text-stone-500 text-[10px] mt-0.5">{{ i.motivo_item }}</div>
                      </td>
                      <td class="px-3 py-2.5 text-center text-stone-300 tabular-nums">{{ i.cantidad }}</td>
                      <td class="px-3 py-2.5 text-right font-medium tabular-nums text-neutral-200">{{ fmt(i.total) }}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr class="border-t border-stone-800/60">
                      <td colspan="2" class="px-3 py-2 text-right text-stone-400 text-xs font-semibold">Total</td>
                      <td class="px-3 py-2 text-right font-bold text-amber-400 tabular-nums">{{ fmt(detalleData.total) }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <!-- Resolución (solo jefe y pendiente) -->
            <div v-if="session?.rol === 'jefe_ventas' && detalleData.estado === 'pendiente'" class="space-y-3">
              <p class="text-xs font-semibold uppercase tracking-wider text-stone-500">Resolución</p>
              <textarea v-model="notaRes" rows="2" placeholder="Nota de resolución (opcional)..."
                class="input resize-none text-sm" />
              <div class="flex gap-2">
                <button @click="resolver('rechazada')" :disabled="!!resolviendo"
                  class="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-red-800/40 bg-red-900/15 text-red-300 hover:bg-red-900/30 disabled:opacity-40 transition-all">
                  <i v-if="resolviendo === 'rechazada'" class="fa-solid fa-circle-notch fa-spin mr-1" />
                  <i v-else class="fa-solid fa-xmark mr-1" />Rechazar
                </button>
                <button @click="resolver('aprobada')" :disabled="!!resolviendo"
                  class="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-green-800/40 bg-green-900/15 text-green-300 hover:bg-green-900/30 disabled:opacity-40 transition-all">
                  <i v-if="resolviendo === 'aprobada'" class="fa-solid fa-circle-notch fa-spin mr-1" />
                  <i v-else class="fa-solid fa-check mr-1" />Aprobar
                </button>
              </div>
            </div>

            <!-- Estado resuelto -->
            <div v-else-if="detalleData.estado !== 'pendiente'"
              class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
              :class="detalleData.estado === 'aprobada' ? 'bg-green-900/20 border border-green-700/30' : 'bg-red-900/20 border border-red-700/30'">
              <i :class="detalleData.estado === 'aprobada' ? 'fa-solid fa-circle-check text-green-400' : 'fa-solid fa-circle-xmark text-red-400'" />
              <div class="text-xs">
                <span :class="detalleData.estado === 'aprobada' ? 'text-green-300 font-semibold' : 'text-red-300 font-semibold'">
                  {{ detalleData.estado === 'aprobada' ? 'Aprobada' : 'Rechazada' }}
                </span>
                <span v-if="detalleData.aprobado_por" class="text-stone-400 ml-1">por {{ detalleData.aprobado_por }}</span>
              </div>
            </div>
          </template>
        </div>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-right-enter-active, .slide-right-leave-active { transition: transform 0.3s cubic-bezier(0.4,0,0.2,1); }
.slide-right-enter-from, .slide-right-leave-to { transform: translateX(100%); }
</style>
