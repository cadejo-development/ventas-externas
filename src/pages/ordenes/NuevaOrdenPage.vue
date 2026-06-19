<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import api, { getSession } from '../../services/api.js'
import PageHeader from '../../components/PageHeader.vue'
import { useToast } from '../../composables/useToast.js'

const router  = useRouter()
const session = getSession()
const { push: toast } = useToast()

const allClientes     = ref([])
const productos       = ref([])
const catalogoLineas  = ref({})   // { [catalogo_id]: { [producto_id]: { precio_sin_iva, precio_con_iva } } }
const loading         = ref(true)
const saving          = ref(false)

const todayISO = new Date().toISOString().slice(0, 10)

const productosPorBodega = computed(() => {
  const grupos = {}
  for (const p of productos.value) {
    const key = p.bodega || 'Otros'
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(p)
  }
  return grupos
})

// ── Autocomplete cliente ──────────────────────────────────────────────────────
const clienteQuery   = ref('')
const showDropdown   = ref(false)
const clienteRef     = ref(null)

const clientesFiltrados = computed(() => {
  if (!clienteQuery.value.trim()) return []
  const s = clienteQuery.value.toLowerCase()
  return allClientes.value
    .filter(c => c.nombres.toLowerCase().includes(s) || (c.nom_comercial || '').toLowerCase().includes(s) || (c.nit || '').includes(s))
    .slice(0, 12)
})

function onClienteInput() { showDropdown.value = true }

async function seleccionarCliente(c) {
  form.value.cliente_id = c.id
  clienteQuery.value    = c.nombres
  showDropdown.value    = false
  if (c.limite_credito <= 0) form.value.tipo_venta = 'contado'

  // Cargar precios del catálogo asignado al cliente
  if (c.catalogo_precio_id && !catalogoLineas.value[c.catalogo_precio_id]) {
    try {
      const { data } = await api.get(`catalogos-precio/${c.catalogo_precio_id}/para-orden`)
      catalogoLineas.value[c.catalogo_precio_id] = data.data ?? {}
    } catch { /* sin catálogo */ }
  }
}

function limpiarCliente() {
  form.value.cliente_id       = null
  form.value.tipo_venta       = 'contado'
  form.value.plazo_solicitado = 0
  clienteQuery.value = ''
  showDropdown.value = false
}

function onClickOutside(e) {
  if (clienteRef.value && !clienteRef.value.contains(e.target)) showDropdown.value = false
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside))

// ── Formulario ────────────────────────────────────────────────────────────────
const form = ref({
  cliente_id: null, tipo_venta: 'contado', plazo_solicitado: 0, notas: '',
  creado_por: session?.nombre || '',
  fecha_facturacion: todayISO,
  fecha_entrega: todayISO,
  items: [],
})

const clienteSeleccionado  = computed(() => allClientes.value.find(c => c.id === form.value.cliente_id))
const esCredito            = computed(() => form.value.tipo_venta === 'credito')
const clienteTieneCredito  = computed(() => (clienteSeleccionado.value?.limite_credito || 0) > 0)
const limiteCredito        = computed(() => clienteSeleccionado.value?.limite_credito || 0)
const plazoMaximo          = computed(() => clienteSeleccionado.value?.plazo_credito || 0)

const IVA       = 0.13
const subtotal  = computed(() => form.value.items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0))
const totalIva  = computed(() => form.value.items.reduce((s, i) => i.exento ? s : s + i.cantidad * i.precio_unitario * IVA, 0))
const total     = computed(() => subtotal.value + totalIva.value)
const excedeLimite  = computed(() => esCredito.value && limiteCredito.value > 0 && total.value > limiteCredito.value)
const excedePlazo   = computed(() => esCredito.value && plazoMaximo.value > 0 && form.value.plazo_solicitado > plazoMaximo.value)

// null = auto-aprobada | 'exceso_limite' | 'cambio_credito' | 'cambio_precio'
const necesitaAprobacion = computed(() => {
  if (!clienteSeleccionado.value) return null
  // Jefe puede modificar precios sin aprobación
  if (session?.rol !== 'jefe_ventas' && hayPreciosModificados.value) return 'cambio_precio'
  if (esCredito.value) {
    if (!clienteTieneCredito.value) return 'cambio_credito'
    if (excedeLimite.value)  return 'exceso_limite'
    if (excedePlazo.value)   return 'cambio_credito'
  }
  return null
})

function addItem() {
  form.value.items.push({ producto_id: null, nombre_producto: '', cantidad: 1, precio_unitario: 0, exento: true, precio_catalogo: null, precio_modificado: false })
}
function removeItem(idx) { form.value.items.splice(idx, 1) }

function onProductoChange(idx) {
  const item   = form.value.items[idx]
  const prod   = productos.value.find(p => p.id == item.producto_id)
  if (!prod) return

  item.nombre_producto = prod.nombre
  item.exento          = prod.exento

  // Buscar precio en catálogo del cliente
  const catId = clienteSeleccionado.value?.catalogo_precio_id
  const lineas = catId ? (catalogoLineas.value[catId] ?? {}) : {}
  const lineaPrecio = lineas[prod.id]

  if (lineaPrecio) {
    item.precio_unitario  = lineaPrecio.precio_sin_iva
    item.precio_catalogo  = lineaPrecio.precio_sin_iva   // referencia original
    item.precio_modificado = false
  } else {
    item.precio_unitario  = prod.precio || 0
    item.precio_catalogo  = null
    item.precio_modificado = false
  }
}

function onPrecioChange(idx) {
  const item = form.value.items[idx]
  if (item.precio_catalogo !== null) {
    item.precio_modificado = item.precio_unitario !== item.precio_catalogo
  }
}

const hayPreciosModificados = computed(() =>
  form.value.items.some(i => i.precio_modificado)
)

async function guardar() {
  if (!form.value.cliente_id) { toast('Selecciona un cliente', 'error'); return }
  if (!form.value.items.length) { toast('Agrega al menos un producto', 'error'); return }

  saving.value = true
  try {
    await api.post('ordenes', {
      ...form.value,
      items: form.value.items.map(i => ({
        producto_id: i.producto_id, cantidad: i.cantidad, precio_unitario: i.precio_unitario,
      }))
    })
    toast(necesitaAprobacion.value ? 'Orden enviada a aprobación' : 'Orden aprobada y guardada')
    router.push('/ordenes')
  } catch (e) {
    toast(e.response?.data?.message || 'Error al guardar la orden', 'error')
  } finally { saving.value = false }
}

function fmt(n) { return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(n || 0) }

onMounted(async () => {
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
  } catch (e) { toast('Error cargando datos', 'error') }
  finally { loading.value = false }
})
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <RouterLink to="/ordenes"
        class="w-8 h-8 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center
               text-stone-400 hover:text-amber-400 hover:border-amber-600/50 transition-all">
        <i class="fa-solid fa-arrow-left text-xs" />
      </RouterLink>
      <div>
        <h1 class="text-xl font-bold text-neutral-100">Nueva orden de venta</h1>
        <p class="text-xs text-stone-500 mt-0.5">Completa los datos de la orden</p>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20 text-stone-500">
      <i class="fa-solid fa-circle-notch fa-spin text-2xl mr-3" />
      Cargando datos...
    </div>

    <form v-else @submit.prevent="guardar" class="space-y-4">

      <!-- ── Encabezado ─────────────────────────────────────────────────────── -->
      <div class="card">
        <div class="section-title mb-4"><i class="fa-solid fa-file-lines text-amber-500/60" />Encabezado</div>

        <div class="space-y-4">
          <!-- Autocomplete Cliente -->
          <div>
            <label class="label">Cliente *</label>
            <div class="relative" ref="clienteRef">
              <div class="relative">
                <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 text-xs pointer-events-none" />
                <input
                  v-model="clienteQuery"
                  @input="onClienteInput"
                  @focus="showDropdown = clienteQuery.length > 0"
                  type="text"
                  placeholder="Buscar por nombre, NIT..."
                  class="input pl-9 pr-9"
                  :class="form.cliente_id ? 'border-amber-500/40 bg-amber-900/10' : ''"
                />
                <button v-if="form.cliente_id" type="button" @click="limpiarCliente"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-red-400 transition-colors">
                  <i class="fa-solid fa-xmark text-xs" />
                </button>
              </div>

              <!-- Dropdown resultados -->
              <div v-if="showDropdown && clientesFiltrados.length"
                class="absolute z-50 w-full mt-1.5 bg-stone-900 border border-stone-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-fade-in">
                <div class="max-h-56 overflow-y-auto">
                  <button v-for="c in clientesFiltrados" :key="c.id" type="button"
                    @click="seleccionarCliente(c)"
                    class="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-amber-500/10 transition-colors group">
                    <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                         :class="c.limite_credito > 0 ? 'bg-blue-900/50 text-blue-300' : 'bg-stone-800 text-stone-400'">
                      {{ c.nombres.charAt(0) }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-medium text-neutral-100 truncate group-hover:text-amber-300 transition-colors">
                        {{ c.nombres }}
                      </div>
                      <div class="text-[10px] text-stone-500 truncate">{{ c.nit || 'Sin NIT' }}</div>
                    </div>
                    <span class="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 font-semibold"
                          :class="c.limite_credito > 0 ? 'bg-blue-900/50 text-blue-300' : 'bg-stone-800 text-stone-400'">
                      {{ c.limite_credito > 0 ? 'crédito' : 'contado' }}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Info cliente seleccionado -->
            <div v-if="clienteSeleccionado"
              class="mt-2 flex items-center gap-3 px-3 py-2 rounded-lg bg-amber-900/10 border border-amber-800/30 animate-fade-in">
              <i class="fa-solid fa-building text-amber-500/60 text-xs" />
              <div class="flex-1 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span class="text-xs text-amber-300 font-medium">{{ clienteSeleccionado.nombres }}</span>
                <template v-if="clienteSeleccionado.catalogo_nombre">
                  <span class="text-stone-600">·</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/40 border border-amber-700/40 text-amber-400 font-semibold">
                    <i class="fa-solid fa-tag mr-1" />{{ clienteSeleccionado.catalogo_nombre }}
                  </span>
                </template>
                <template v-if="clienteSeleccionado.limite_credito > 0">
                  <span class="text-stone-600">·</span>
                  <span class="text-xs text-stone-400">Límite: <span class="text-amber-400 font-semibold">${{ clienteSeleccionado.limite_credito.toLocaleString() }}</span></span>
                  <span class="text-stone-600">·</span>
                  <span class="text-xs text-stone-400">Plazo: <span class="text-stone-300">{{ clienteSeleccionado.plazo_credito }} días</span></span>
                </template>
              </div>
            </div>
          </div>

          <!-- Tipo de venta + Plazo/Notas -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">Tipo de venta</label>
              <div class="flex gap-2">
                <button type="button" @click="form.tipo_venta = 'contado'"
                  class="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all"
                  :class="form.tipo_venta === 'contado'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-600'">
                  <i class="fa-solid fa-money-bill-wave mr-1.5" />Contado
                </button>
                <button type="button" @click="form.tipo_venta = 'credito'"
                  :disabled="!clienteSeleccionado"
                  class="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  :class="form.tipo_venta === 'credito'
                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                    : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-600'">
                  <i class="fa-solid fa-credit-card mr-1.5" />Crédito
                </button>
              </div>
            </div>

            <div v-if="esCredito">
              <label class="label">Plazo solicitado (días)</label>
              <input v-model.number="form.plazo_solicitado" type="number" min="0"
                class="input" :class="excedePlazo ? 'border-amber-500/60' : ''" />
              <p v-if="excedePlazo" class="text-xs text-amber-400 mt-1">
                <i class="fa-solid fa-triangle-exclamation mr-1" />Supera el plazo estándar ({{ plazoMaximo }} días) — requiere aprobación
              </p>
            </div>
            <div v-else>
              <label class="label">Notas</label>
              <input v-model="form.notas" type="text" placeholder="Opcional..." class="input" />
            </div>
          </div>

          <!-- Notas (cuando es crédito) -->
          <div v-if="esCredito">
            <label class="label">Notas <span class="text-stone-600 font-normal normal-case">(opcional)</span></label>
            <input v-model="form.notas" type="text" placeholder="Opcional..." class="input" />
          </div>

          <!-- Fechas -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">Fecha de facturación</label>
              <input v-model="form.fecha_facturacion" type="date" :min="todayISO" class="input" />
            </div>
            <div>
              <label class="label">Fecha de entrega</label>
              <input v-model="form.fecha_entrega" type="date" :min="todayISO" class="input" />
            </div>
          </div>

          <!-- Indicador de estado de aprobación -->
          <Transition name="fade">
            <div v-if="clienteSeleccionado">
              <div v-if="necesitaAprobacion === 'exceso_limite'"
                class="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-900/20 border border-amber-700/40">
                <i class="fa-solid fa-clock text-amber-400 mt-0.5 text-sm flex-shrink-0" />
                <p class="text-xs text-amber-300">
                  Esta orden <strong>excede el límite de crédito</strong> (${{ limiteCredito.toLocaleString() }}) —
                  se enviará a aprobación del jefe de ventas.
                </p>
              </div>
              <div v-else-if="necesitaAprobacion === 'cambio_precio'"
                class="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-900/20 border border-amber-700/40">
                <i class="fa-solid fa-tag text-amber-400 mt-0.5 text-sm flex-shrink-0" />
                <p class="text-xs text-amber-300">
                  Uno o más precios fueron <strong>modificados del catálogo</strong> — se enviará a aprobación del jefe de ventas.
                </p>
              </div>
              <div v-else-if="necesitaAprobacion === 'cambio_credito'"
                class="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-blue-900/20 border border-blue-700/40">
                <i class="fa-solid fa-clock text-blue-400 mt-0.5 text-sm flex-shrink-0" />
                <p class="text-xs text-blue-300">
                  Esta orden requiere <strong>aprobación del jefe de ventas</strong> por las condiciones de crédito solicitadas.
                </p>
              </div>
              <div v-else
                class="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-green-900/20 border border-green-700/30">
                <i class="fa-solid fa-circle-check text-green-400 text-sm" />
                <p class="text-xs text-green-300">Esta orden se <strong>aprobará automáticamente</strong> al guardar.</p>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- ── Productos ──────────────────────────────────────────────────────── -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <div class="section-title flex-1"><i class="fa-solid fa-cubes text-amber-500/60" />Productos</div>
          <button type="button" @click="addItem" class="btn btn-secondary btn-sm ml-4">
            <i class="fa-solid fa-plus" />Agregar
          </button>
        </div>

        <div v-if="!form.items.length"
          class="text-center py-10 text-stone-500 border-2 border-dashed border-stone-800 rounded-xl">
          <i class="fa-solid fa-box-open text-3xl mb-2 block opacity-30" />
          <p class="text-sm">Agrega productos a la orden</p>
          <button type="button" @click="addItem" class="btn btn-primary btn-sm mt-3">
            <i class="fa-solid fa-plus" />Agregar producto
          </button>
        </div>

        <div class="space-y-2">
          <div v-for="(item, idx) in form.items" :key="idx"
            class="flex gap-2 items-start bg-stone-800/30 border border-stone-800/60 rounded-xl p-3 group animate-fade-in">

            <div class="flex-1 min-w-0">
              <label class="label">Producto</label>
              <select v-model="item.producto_id" @change="onProductoChange(idx)" class="select text-sm">
                <option :value="null">— Seleccionar —</option>
                <optgroup v-for="(prods, bodega) in productosPorBodega" :key="bodega" :label="bodega">
                  <option v-for="p in prods" :key="p.id" :value="p.id">
                    {{ p.nombre }} ({{ p.existencias }} disp.)
                  </option>
                </optgroup>
              </select>
            </div>

            <div class="w-24 flex-shrink-0">
              <label class="label">Cantidad</label>
              <input v-model.number="item.cantidad" type="number" min="0.01" step="0.01" class="input text-sm text-center" />
            </div>

            <div class="w-28 flex-shrink-0">
              <label class="label flex items-center gap-1">
                Precio unit.
                <span v-if="item.precio_modificado" class="text-amber-400 text-[10px]" title="Precio modificado del catálogo — requiere aprobación">
                  <i class="fa-solid fa-triangle-exclamation" />
                </span>
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs">$</span>
                <input v-model.number="item.precio_unitario" type="number" min="0" step="0.01"
                  @input="onPrecioChange(idx)"
                  class="input text-sm pl-6 text-right"
                  :class="item.precio_modificado ? 'border-amber-500/60 bg-amber-900/10' : ''" />
              </div>
              <p v-if="item.precio_catalogo !== null && item.precio_modificado" class="text-[10px] text-stone-500 mt-0.5 text-right">
                Catálogo: ${{ item.precio_catalogo?.toFixed(2) }}
              </p>
            </div>

            <div class="w-24 flex-shrink-0">
              <label class="label">Subtotal</label>
              <div class="h-10 flex items-center justify-end">
                <div>
                  <div class="text-sm font-semibold tabular-nums text-neutral-100">
                    {{ fmt(item.cantidad * item.precio_unitario) }}
                  </div>
                  <div v-if="!item.exento" class="text-[10px] text-blue-400 text-right">+IVA</div>
                </div>
              </div>
            </div>

            <button type="button" @click="removeItem(idx)"
              class="mt-6 w-7 h-7 rounded-lg text-stone-700 hover:text-red-400 hover:bg-red-900/20 transition-all flex items-center justify-center flex-shrink-0">
              <i class="fa-solid fa-xmark text-xs" />
            </button>
          </div>
        </div>

        <!-- Totales -->
        <div v-if="form.items.length" class="mt-4 pt-4 border-t border-stone-800/60 space-y-1">
          <div class="flex justify-between text-sm text-stone-400">
            <span>Subtotal</span><span class="tabular-nums">{{ fmt(subtotal) }}</span>
          </div>
          <div class="flex justify-between text-sm text-stone-400">
            <span>IVA (13%)</span><span class="tabular-nums">{{ fmt(totalIva) }}</span>
          </div>
          <div class="flex justify-between text-base font-bold text-neutral-100 pt-1 border-t border-stone-800/40">
            <span>Total</span><span class="tabular-nums text-amber-400">{{ fmt(total) }}</span>
          </div>
        </div>
      </div>

      <!-- ── Acciones ───────────────────────────────────────────────────────── -->
      <div class="flex justify-end gap-3 pb-4">
        <RouterLink to="/ordenes" class="btn btn-secondary">
          <i class="fa-solid fa-xmark" />Cancelar
        </RouterLink>
        <button type="submit" :disabled="saving" class="btn btn-primary btn-lg">
          <i v-if="saving" class="fa-solid fa-circle-notch fa-spin" />
          <i v-else-if="necesitaAprobacion" class="fa-solid fa-paper-plane" />
          <i v-else class="fa-solid fa-floppy-disk" />
          {{ saving ? 'Guardando...' : necesitaAprobacion ? 'Enviar a aprobación' : 'Guardar orden' }}
        </button>
      </div>
    </form>
  </div>
</template>
