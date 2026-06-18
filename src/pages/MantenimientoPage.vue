<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../services/api.js'
import { useToast } from '../composables/useToast.js'

const { push: toast } = useToast()

// ── Tabs ──────────────────────────────────────────────────────────────────────
const tabActiva = ref('catalogos')

// ── Catálogos ─────────────────────────────────────────────────────────────────
const catalogos       = ref([])
const loadingCatalogos = ref(false)
const showModalCatalogo = ref(false)
const editandoCatalogo  = ref(null)
const savingCatalogo    = ref(false)
const formCatalogo = ref({ nombre: '', descripcion: '', dias_alerta_revision: 90 })

// Líneas del catálogo seleccionado
const catalogoActivo  = ref(null)
const lineas          = ref([])
const loadingLineas   = ref(false)
const productos       = ref([])
const showModalLinea  = ref(false)
const editandoLinea   = ref(null)
const savingLinea     = ref(false)
const formLinea = ref({ producto_id: '', precio_sin_iva: '', precio_con_iva: '' })

const IVA = 0.13

async function cargarCatalogos() {
  loadingCatalogos.value = true
  try {
    const { data } = await api.get('catalogos-precio')
    catalogos.value = data.data ?? []
  } catch { toast('Error cargando catálogos', 'error') }
  finally { loadingCatalogos.value = false }
}

async function cargarLineas(cat) {
  catalogoActivo.value = cat
  loadingLineas.value = true
  try {
    const { data } = await api.get(`catalogos-precio/${cat.id}/lineas`)
    lineas.value = data.data ?? []
  } catch { toast('Error cargando líneas', 'error') }
  finally { loadingLineas.value = false }
}

async function cargarProductos() {
  if (productos.value.length) return
  try {
    const { data } = await api.get('productos')
    productos.value = data ?? []
  } catch { toast('Error cargando productos', 'error') }
}

// ── CRUD catálogos ────────────────────────────────────────────────────────────
function abrirNuevoCatalogo() {
  editandoCatalogo.value = null
  formCatalogo.value = { nombre: '', descripcion: '', dias_alerta_revision: 90 }
  showModalCatalogo.value = true
}

function abrirEditarCatalogo(c) {
  editandoCatalogo.value = c.id
  formCatalogo.value = { nombre: c.nombre, descripcion: c.descripcion ?? '', dias_alerta_revision: c.dias_alerta_revision }
  showModalCatalogo.value = true
}

async function guardarCatalogo() {
  savingCatalogo.value = true
  try {
    if (editandoCatalogo.value) {
      const { data } = await api.patch(`catalogos-precio/${editandoCatalogo.value}`, formCatalogo.value)
      const idx = catalogos.value.findIndex(c => c.id === editandoCatalogo.value)
      if (idx !== -1) catalogos.value[idx] = data
      if (catalogoActivo.value?.id === editandoCatalogo.value) catalogoActivo.value = data
    } else {
      const { data } = await api.post('catalogos-precio', formCatalogo.value)
      catalogos.value.push(data)
    }
    showModalCatalogo.value = false
    toast(editandoCatalogo.value ? 'Catálogo actualizado' : 'Catálogo creado')
  } catch (e) { toast(e.response?.data?.message || 'Error al guardar', 'error') }
  finally { savingCatalogo.value = false }
}

async function toggleCatalogo(c) {
  try {
    const { data } = await api.patch(`catalogos-precio/${c.id}/toggle`)
    const idx = catalogos.value.findIndex(x => x.id === c.id)
    if (idx !== -1) catalogos.value[idx] = data
    toast(data.activo ? 'Catálogo activado' : 'Catálogo desactivado')
  } catch { toast('Error', 'error') }
}

async function eliminarCatalogo(c) {
  if (!confirm(`¿Eliminar el catálogo "${c.nombre}"? Esta acción no se puede deshacer.`)) return
  try {
    await api.delete(`catalogos-precio/${c.id}`)
    catalogos.value = catalogos.value.filter(x => x.id !== c.id)
    if (catalogoActivo.value?.id === c.id) { catalogoActivo.value = null; lineas.value = [] }
    toast('Catálogo eliminado')
  } catch (e) { toast(e.response?.data?.message || 'No se pudo eliminar', 'error') }
}

// ── CRUD líneas ───────────────────────────────────────────────────────────────
function abrirNuevaLinea() {
  editandoLinea.value = null
  formLinea.value = { producto_id: '', precio_sin_iva: '', precio_con_iva: '' }
  cargarProductos()
  showModalLinea.value = true
}

function abrirEditarLinea(l) {
  editandoLinea.value = l.id
  formLinea.value = { producto_id: l.producto_id, precio_sin_iva: l.precio_sin_iva, precio_con_iva: l.precio_con_iva }
  cargarProductos()
  showModalLinea.value = true
}

function onPrecioSinIvaChange() {
  const sin = parseFloat(formLinea.value.precio_sin_iva)
  if (!isNaN(sin) && sin > 0) {
    formLinea.value.precio_con_iva = +(sin * (1 + IVA)).toFixed(4)
  }
}

function onPrecioConIvaChange() {
  const con = parseFloat(formLinea.value.precio_con_iva)
  if (!isNaN(con) && con > 0) {
    formLinea.value.precio_sin_iva = +(con / (1 + IVA)).toFixed(4)
  }
}

async function guardarLinea() {
  if (!catalogoActivo.value) return
  savingLinea.value = true
  try {
    if (editandoLinea.value) {
      const { data } = await api.patch(
        `catalogos-precio/${catalogoActivo.value.id}/lineas/${editandoLinea.value}`,
        { precio_sin_iva: formLinea.value.precio_sin_iva, precio_con_iva: formLinea.value.precio_con_iva }
      )
      const idx = lineas.value.findIndex(l => l.id === editandoLinea.value)
      if (idx !== -1) lineas.value[idx] = data
    } else {
      const { data } = await api.post(
        `catalogos-precio/${catalogoActivo.value.id}/lineas`,
        formLinea.value
      )
      const idx = lineas.value.findIndex(l => l.producto_id === data.producto_id)
      if (idx !== -1) lineas.value[idx] = data
      else lineas.value.push(data)
    }
    showModalLinea.value = false
    toast('Precio guardado')
    await cargarCatalogos() // refresca lineas_count
  } catch (e) { toast(e.response?.data?.message || 'Error al guardar', 'error') }
  finally { savingLinea.value = false }
}

async function eliminarLinea(l) {
  if (!confirm('¿Eliminar este precio del catálogo?')) return
  try {
    await api.delete(`catalogos-precio/${catalogoActivo.value.id}/lineas/${l.id}`)
    lineas.value = lineas.value.filter(x => x.id !== l.id)
    toast('Precio eliminado')
    await cargarCatalogos()
  } catch { toast('Error al eliminar', 'error') }
}

// ── Computed ─────────────────────────────────────────────────────────────────
const productosDisponibles = computed(() => {
  const enCatalogo = new Set(lineas.value.map(l => l.producto_id))
  if (editandoLinea.value) return productos.value
  return productos.value.filter(p => !enCatalogo.has(p.id))
})

const productosPorBodega = computed(() => {
  const grupos = {}
  for (const p of productosDisponibles.value) {
    const key = p.bodega || 'Otros'
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(p)
  }
  return grupos
})

function fmt(n) { return new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(n ?? 0) }
function fmtDias(n) { return n === 1 ? '1 día' : `${n} días` }

onMounted(() => cargarCatalogos())
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-neutral-100">Mantenimiento</h1>
      <p class="text-sm text-stone-500 mt-0.5">Configuración de catálogos de precios y parámetros del sistema</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 border-b border-stone-800 mb-6">
      <button @click="tabActiva = 'catalogos'"
        class="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors"
        :class="tabActiva === 'catalogos' ? 'bg-stone-800 text-amber-400 border-b-2 border-amber-500' : 'text-stone-400 hover:text-stone-200'">
        <i class="fa-solid fa-tags mr-2" />Catálogos de Precios
      </button>
    </div>

    <!-- ── Tab: Catálogos ─────────────────────────────────────────────────── -->
    <div v-if="tabActiva === 'catalogos'" class="grid grid-cols-1 xl:grid-cols-2 gap-6">

      <!-- Panel izquierdo: lista de catálogos -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="font-semibold text-neutral-100">Catálogos</h2>
            <p class="text-xs text-stone-500 mt-0.5">Tarifas asignables a clientes</p>
          </div>
          <button @click="abrirNuevoCatalogo" class="btn btn-primary btn-sm">
            <i class="fa-solid fa-plus" /> Nuevo
          </button>
        </div>

        <div v-if="loadingCatalogos" class="py-8 text-center text-stone-600">
          <i class="fa-solid fa-circle-notch fa-spin" />
        </div>
        <div v-else-if="!catalogos.length" class="py-8 text-center text-stone-600 text-sm">
          No hay catálogos. Crea el primero.
        </div>
        <div v-else class="space-y-1.5">
          <div
            v-for="c in catalogos" :key="c.id"
            @click="cargarLineas(c)"
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all"
            :class="catalogoActivo?.id === c.id
              ? 'border-amber-600/50 bg-amber-900/10'
              : 'border-stone-800/60 bg-stone-900/40 hover:border-stone-700 hover:bg-stone-800/30'"
          >
            <!-- Alerta revisión -->
            <div class="w-2 h-2 rounded-full flex-shrink-0"
                 :class="c.alerta_revision ? 'bg-rose-500' : (c.activo ? 'bg-emerald-500' : 'bg-stone-600')" />

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm" :class="c.activo ? 'text-neutral-100' : 'text-stone-500'">
                  {{ c.nombre }}
                </span>
                <span v-if="!c.activo" class="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-800 text-stone-500">Inactivo</span>
                <span v-if="c.alerta_revision" class="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-900/50 text-rose-400">
                  <i class="fa-solid fa-triangle-exclamation mr-1" />Revisar precios
                </span>
              </div>
              <div class="text-[11px] text-stone-500 mt-0.5">
                {{ c.lineas_count }} productos · {{ c.clientes_count }} clientes
                <span v-if="c.updated_at" class="ml-2">· act. {{ c.updated_at }}</span>
              </div>
            </div>

            <div class="flex items-center gap-1 flex-shrink-0">
              <button @click.stop="abrirEditarCatalogo(c)" class="btn btn-ghost btn-xs w-7 h-7 p-0 rounded-lg" title="Editar">
                <i class="fa-solid fa-pen text-stone-500 text-xs" />
              </button>
              <button @click.stop="toggleCatalogo(c)" class="btn btn-ghost btn-xs w-7 h-7 p-0 rounded-lg" :title="c.activo ? 'Desactivar' : 'Activar'">
                <i class="fa-solid text-xs" :class="c.activo ? 'fa-eye-slash text-stone-500' : 'fa-eye text-emerald-500'" />
              </button>
              <button @click.stop="eliminarCatalogo(c)" class="btn btn-ghost btn-xs w-7 h-7 p-0 rounded-lg" title="Eliminar">
                <i class="fa-solid fa-trash text-stone-600 hover:text-rose-400 text-xs" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Panel derecho: líneas del catálogo seleccionado -->
      <div class="card">
        <template v-if="!catalogoActivo">
          <div class="py-16 text-center text-stone-600">
            <i class="fa-solid fa-tags text-4xl mb-3 block opacity-20" />
            <p class="text-sm">Selecciona un catálogo para ver y editar sus precios</p>
          </div>
        </template>

        <template v-else>
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="font-semibold text-neutral-100">{{ catalogoActivo.nombre }}</h2>
              <p class="text-xs text-stone-500 mt-0.5">{{ catalogoActivo.descripcion || 'Precios por producto' }}</p>
            </div>
            <button @click="abrirNuevaLinea" class="btn btn-primary btn-sm">
              <i class="fa-solid fa-plus" /> Agregar precio
            </button>
          </div>

          <div v-if="loadingLineas" class="py-8 text-center text-stone-600">
            <i class="fa-solid fa-circle-notch fa-spin" />
          </div>
          <div v-else-if="!lineas.length" class="py-8 text-center text-stone-600 text-sm">
            No hay precios configurados en este catálogo.
          </div>
          <div v-else class="divide-y divide-stone-800/60">
            <div v-for="l in lineas" :key="l.id" class="flex items-center gap-3 py-2.5">
              <div class="flex-1 min-w-0">
                <div class="text-sm text-neutral-200 font-medium truncate">{{ l.nombre_producto }}</div>
                <div class="text-[11px] text-stone-500">
                  <span class="font-mono">{{ l.codigo }}</span>
                  <span v-if="l.bodega" class="ml-2">· {{ l.bodega }}</span>
                </div>
              </div>
              <div class="text-right flex-shrink-0">
                <div class="text-sm font-semibold text-amber-400 tabular-nums">{{ fmt(l.precio_con_iva) }}</div>
                <div class="text-[11px] text-stone-500 tabular-nums">{{ fmt(l.precio_sin_iva) }} sin IVA</div>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <button @click="abrirEditarLinea(l)" class="btn btn-ghost btn-xs w-7 h-7 p-0 rounded-lg">
                  <i class="fa-solid fa-pen text-stone-500 text-xs" />
                </button>
                <button @click="eliminarLinea(l)" class="btn btn-ghost btn-xs w-7 h-7 p-0 rounded-lg">
                  <i class="fa-solid fa-trash text-stone-600 hover:text-rose-400 text-xs" />
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- ── Modal: catálogo ────────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModalCatalogo" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
             @click.self="showModalCatalogo = false">
          <div class="bg-stone-900 border border-stone-700/60 rounded-2xl shadow-2xl w-full max-w-md">
            <div class="flex items-center justify-between px-6 py-4 border-b border-stone-800">
              <h3 class="font-bold text-neutral-100">{{ editandoCatalogo ? 'Editar catálogo' : 'Nuevo catálogo' }}</h3>
              <button @click="showModalCatalogo = false" class="btn btn-ghost btn-xs w-8 h-8 p-0 rounded-lg">
                <i class="fa-solid fa-xmark" />
              </button>
            </div>
            <form @submit.prevent="guardarCatalogo" class="p-6 space-y-4">
              <div>
                <label class="label">Nombre *</label>
                <input v-model="formCatalogo.nombre" required type="text" class="input" placeholder="Ej: Hotel Quality" />
              </div>
              <div>
                <label class="label">Descripción</label>
                <input v-model="formCatalogo.descripcion" type="text" class="input" placeholder="Descripción opcional" />
              </div>
              <div>
                <label class="label">Alerta de revisión (días)</label>
                <input v-model.number="formCatalogo.dias_alerta_revision" type="number" min="1" max="365" class="input" />
                <p class="text-[11px] text-stone-500 mt-1">Se mostrará alerta si los precios llevan más de este tiempo sin actualizar.</p>
              </div>
              <div class="flex justify-end gap-3 pt-2 border-t border-stone-800">
                <button type="button" @click="showModalCatalogo = false" class="btn btn-secondary">Cancelar</button>
                <button type="submit" :disabled="savingCatalogo" class="btn btn-primary">
                  <i v-if="savingCatalogo" class="fa-solid fa-circle-notch fa-spin" />
                  {{ savingCatalogo ? 'Guardando...' : 'Guardar' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── Modal: línea de precio ─────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModalLinea" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
             @click.self="showModalLinea = false">
          <div class="bg-stone-900 border border-stone-700/60 rounded-2xl shadow-2xl w-full max-w-md">
            <div class="flex items-center justify-between px-6 py-4 border-b border-stone-800">
              <h3 class="font-bold text-neutral-100">{{ editandoLinea ? 'Editar precio' : 'Agregar precio' }}</h3>
              <p class="text-xs text-stone-500 mt-0.5">{{ catalogoActivo?.nombre }}</p>
              <button @click="showModalLinea = false" class="btn btn-ghost btn-xs w-8 h-8 p-0 rounded-lg">
                <i class="fa-solid fa-xmark" />
              </button>
            </div>
            <form @submit.prevent="guardarLinea" class="p-6 space-y-4">
              <div v-if="!editandoLinea">
                <label class="label">Producto *</label>
                <select v-model="formLinea.producto_id" required class="input">
                  <option value="">— Selecciona producto —</option>
                  <optgroup v-for="(prods, bodega) in productosPorBodega" :key="bodega" :label="bodega">
                    <option v-for="p in prods" :key="p.id" :value="p.id">
                      {{ p.nombre }} ({{ p.codigo }})
                    </option>
                  </optgroup>
                </select>
              </div>
              <div v-else class="px-3 py-2 bg-stone-800/50 rounded-xl text-sm text-stone-300">
                <span class="font-medium">{{ lineas.find(l => l.id === editandoLinea)?.nombre_producto }}</span>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="label">Precio sin IVA *</label>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs">$</span>
                    <input v-model.number="formLinea.precio_sin_iva" @input="onPrecioSinIvaChange"
                           required type="number" min="0" step="0.0001" class="input pl-6" />
                  </div>
                </div>
                <div>
                  <label class="label">Precio con IVA *</label>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs">$</span>
                    <input v-model.number="formLinea.precio_con_iva" @input="onPrecioConIvaChange"
                           required type="number" min="0" step="0.0001" class="input pl-6" />
                  </div>
                </div>
              </div>
              <p class="text-[11px] text-stone-500">Al ingresar uno, el otro se calcula automáticamente (IVA 13%).</p>

              <div class="flex justify-end gap-3 pt-2 border-t border-stone-800">
                <button type="button" @click="showModalLinea = false" class="btn btn-secondary">Cancelar</button>
                <button type="submit" :disabled="savingLinea" class="btn btn-primary">
                  <i v-if="savingLinea" class="fa-solid fa-circle-notch fa-spin" />
                  {{ savingLinea ? 'Guardando...' : 'Guardar precio' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
