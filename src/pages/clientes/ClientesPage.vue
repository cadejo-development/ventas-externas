<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '../../services/api.js'
import PageHeader from '../../components/PageHeader.vue'
import { useToast } from '../../composables/useToast.js'

const { push: toast } = useToast()
const clientes   = ref([])
const catalogos  = ref([])
const meta       = ref({ current_page: 1, last_page: 1, total: 0 })
const loading    = ref(true)
const search     = ref('')
const filtroTipo = ref('')
const page       = ref(1)

const showModal = ref(false)
const editing   = ref(null)
const saving    = ref(false)
const form      = ref(emptyForm())

function emptyForm() {
  return { nombres: '', nom_comercial: '', nit: '', registro_iva: '', email: '', telefono: '', direccion: '', exento: false, plazo_credito: 0, limite_credito: 0, catalogo_precio_id: null }
}

async function cargarCatalogos() {
  try {
    const { data } = await api.get('catalogos-precio')
    catalogos.value = (data.data ?? []).filter(c => c.activo)
  } catch { /* silencioso */ }
}

async function cargar(p = page.value) {
  page.value = p; loading.value = true
  try {
    const { data } = await api.get('clientes', { params: { search: search.value, tipo: filtroTipo.value, page: p } })
    clientes.value = data.data; meta.value = data
  } catch { toast('Error cargando clientes', 'error') }
  finally { loading.value = false }
}

onMounted(() => { cargar(1); cargarCatalogos() })

let debounce
watch([search, filtroTipo], () => { clearTimeout(debounce); debounce = setTimeout(() => cargar(1), 350) })

const paginasVisibles = computed(() => {
  const t = meta.value.last_page, c = meta.value.current_page
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  return [...new Set([1, t, c, c-1, c+1].filter(p => p >= 1 && p <= t))].sort((a,b) => a-b)
})

function abrirNuevo() { editing.value = null; form.value = emptyForm(); showModal.value = true }
function abrirEditar(c) { editing.value = c.id; form.value = { ...c }; showModal.value = true }

async function guardar() {
  saving.value = true
  try {
    if (editing.value) {
      const { data, status } = await api.patch(`clientes/${editing.value}`, form.value)
      showModal.value = false
      if (status === 202) {
        toast('Cambios enviados a aprobación del jefe de ventas', 'warning')
      } else {
        toast('Cliente actualizado')
        await cargar()
      }
    } else {
      await api.post('clientes', form.value)
      showModal.value = false
      toast('Cliente creado')
      await cargar()
    }
  } catch (e) { toast(e.response?.data?.message || 'Error al guardar', 'error') }
  finally { saving.value = false }
}

const esCredito = (c) => c.limite_credito > 0

// ── Documentos de cliente ─────────────────────────────────────────────────────
const showDocModal    = ref(false)
const docClienteId    = ref(null)
const docClienteNombre = ref('')
const documentos      = ref([])
const loadingDocs     = ref(false)
const savingDoc       = ref(false)
const docForm         = ref({ tipo: 'tarjeta_iva', archivo: null })

const TIPO_DOC_LABELS = {
  tarjeta_iva:    'Tarjeta IVA',
  carta_exencion: 'Carta de exención',
  otro:           'Otro',
}

async function abrirDocumentos(c) {
  docClienteId.value     = c.id
  docClienteNombre.value = c.nombres
  showDocModal.value     = true
  loadingDocs.value      = true
  try {
    const { data } = await api.get(`clientes/${c.id}/documentos`)
    documentos.value = data.data ?? []
  } catch { toast('Error cargando documentos', 'error') }
  finally { loadingDocs.value = false }
}

function onArchivoChange(e) {
  docForm.value.archivo = e.target.files[0] ?? null
}

async function subirDocumento() {
  if (!docForm.value.archivo) { toast('Selecciona un archivo', 'error'); return }
  savingDoc.value = true
  try {
    const fd = new FormData()
    fd.append('tipo', docForm.value.tipo)
    fd.append('archivo', docForm.value.archivo)
    await api.post(`clientes/${docClienteId.value}/documentos`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    toast('Documento subido')
    docForm.value = { tipo: 'tarjeta_iva', archivo: null }
    const { data } = await api.get(`clientes/${docClienteId.value}/documentos`)
    documentos.value = data.data ?? []
  } catch (e) { toast(e.response?.data?.message || 'Error al subir', 'error') }
  finally { savingDoc.value = false }
}

async function descargarDoc(docId) {
  try {
    const { data } = await api.get(`clientes/${docClienteId.value}/documentos/${docId}`)
    window.open(data.url, '_blank')
  } catch { toast('Error al obtener enlace', 'error') }
}

async function eliminarDoc(docId) {
  if (!confirm('¿Eliminar este documento?')) return
  try {
    await api.delete(`clientes/${docClienteId.value}/documentos/${docId}`)
    documentos.value = documentos.value.filter(d => d.id !== docId)
    toast('Documento eliminado')
  } catch { toast('Error al eliminar', 'error') }
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-start justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-neutral-100">Clientes</h1>
        <p class="text-sm text-stone-500 mt-0.5">
          <span class="text-amber-400 font-semibold">{{ meta.total?.toLocaleString() }}</span> clientes registrados
        </p>
      </div>
      <button @click="abrirNuevo" class="btn btn-primary">
        <i class="fa-solid fa-plus" />Nuevo cliente
      </button>
    </div>

    <!-- Filtros -->
    <div class="flex flex-wrap gap-3 mb-5">
      <div class="relative flex-1 min-w-48 max-w-xs">
        <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 text-xs pointer-events-none" />
        <input v-model="search" type="text" placeholder="Buscar por nombre o NIT..."
          class="input pl-9" />
      </div>
      <div class="flex gap-1 bg-stone-900 border border-stone-800 rounded-xl p-1">
        <button v-for="[v, l] in [['','Todos'],['credito','Crédito'],['contado','Contado']]" :key="v"
          @click="filtroTipo = v"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          :class="filtroTipo === v ? 'bg-amber-500 text-stone-950 shadow-sm' : 'text-stone-400 hover:text-stone-200'">
          {{ l }}
        </button>
      </div>
    </div>

    <!-- Skeleton -->
    <div v-if="loading" class="table-wrapper">
      <div v-for="i in 8" :key="i" class="flex gap-4 px-4 py-3.5 border-b border-stone-900 animate-pulse">
        <div class="w-8 h-8 bg-stone-800 rounded-lg flex-shrink-0" />
        <div class="flex-1 space-y-2">
          <div class="h-3 bg-stone-800 rounded w-2/5" />
          <div class="h-2.5 bg-stone-900 rounded w-1/4" />
        </div>
        <div class="h-3 bg-stone-800 rounded w-16 mt-1" />
      </div>
    </div>

    <div v-else>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>NIT</th>
              <th>Catálogo</th>
              <th>Tipo</th>
              <th class="text-right">Límite crédito</th>
              <th class="text-right hidden md:table-cell">Plazo</th>
              <th class="text-right hidden lg:table-cell">Días pago</th>
              <th class="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in clientes" :key="c.id">
              <td>
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                       :class="esCredito(c) ? 'bg-blue-900/40 text-blue-300' : 'bg-stone-800 text-stone-400'">
                    {{ c.nombres.charAt(0) }}
                  </div>
                  <div class="min-w-0">
                    <div class="font-semibold text-neutral-100 text-sm truncate">{{ c.nombres }}</div>
                    <div v-if="c.nom_comercial" class="text-xs text-stone-500 truncate">{{ c.nom_comercial }}</div>
                  </div>
                </div>
              </td>
              <td class="text-stone-400 text-xs font-mono">{{ c.nit || '—' }}</td>
              <td>
                <span v-if="c.catalogo_nombre" class="badge badge-amber text-xs">
                  <i class="fa-solid fa-tag mr-1" />{{ c.catalogo_nombre }}
                </span>
                <span v-else class="text-stone-600 text-xs">—</span>
              </td>
              <td>
                <span class="badge" :class="esCredito(c) ? 'badge-blue' : 'badge-stone'">
                  <i :class="esCredito(c) ? 'fa-solid fa-credit-card' : 'fa-solid fa-money-bill-wave'" />
                  {{ esCredito(c) ? 'crédito' : 'contado' }}
                </span>
              </td>
              <td class="text-right tabular-nums">
                <span v-if="esCredito(c)" class="text-amber-400 font-semibold text-sm">
                  ${{ c.limite_credito.toLocaleString() }}
                </span>
                <span v-else class="text-stone-700">—</span>
              </td>
              <td class="text-right text-stone-400 text-xs hidden md:table-cell">
                {{ c.plazo_credito > 0 ? `${c.plazo_credito} días` : '—' }}
              </td>
              <td class="text-right hidden lg:table-cell">
                <span v-if="c.avg_dias_pago !== null && c.avg_dias_pago !== undefined"
                      class="text-xs tabular-nums font-medium"
                      :class="c.avg_dias_pago > (c.plazo_credito || 30) ? 'text-rose-400' : 'text-emerald-400'">
                  {{ c.avg_dias_pago }} d
                </span>
                <span v-else class="text-stone-700 text-xs">—</span>
              </td>
              <td class="text-center">
                <div class="flex items-center justify-center gap-1">
                  <button class="btn btn-ghost btn-xs" @click="abrirDocumentos(c)" title="Documentos">
                    <i class="fa-solid fa-paperclip text-stone-500" />
                  </button>
                  <button class="btn btn-ghost btn-xs" @click="abrirEditar(c)" title="Editar">
                    <i class="fa-solid fa-pen-to-square text-stone-500" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!clientes.length">
              <td colspan="8" class="py-16 text-center text-stone-500">
                <i class="fa-solid fa-building text-4xl mb-3 block opacity-20" />
                No se encontraron clientes
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Paginación -->
        <div v-if="meta.last_page > 1"
          class="flex items-center justify-between px-4 py-3 border-t border-stone-900 text-xs text-stone-500">
          <span>{{ meta.total }} clientes · pág. {{ meta.current_page }}/{{ meta.last_page }}</span>
          <div class="flex items-center gap-1">
            <button class="btn btn-ghost btn-xs px-2" :disabled="meta.current_page === 1" @click="cargar(meta.current_page - 1)">
              <i class="fa-solid fa-chevron-left" />
            </button>
            <button v-for="p in paginasVisibles" :key="p"
              class="btn btn-xs transition-all"
              :class="p === meta.current_page ? 'btn-primary shadow-none py-1' : 'btn-ghost'"
              @click="cargar(p)">{{ p }}</button>
            <button class="btn btn-ghost btn-xs px-2" :disabled="meta.current_page === meta.last_page" @click="cargar(meta.current_page + 1)">
              <i class="fa-solid fa-chevron-right" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal nuevo/editar -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
           @click.self="showModal = false">
        <div class="bg-stone-900 border border-stone-700/60 rounded-2xl shadow-2xl w-full max-w-lg animate-slide-in">

          <!-- Modal header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-stone-800">
            <div>
              <h3 class="font-bold text-neutral-100">{{ editing ? 'Editar cliente' : 'Nuevo cliente' }}</h3>
              <p class="text-xs text-stone-500 mt-0.5">{{ editing ? 'Modifica los datos del cliente' : 'Completa los datos del nuevo cliente' }}</p>
            </div>
            <button @click="showModal = false" class="btn btn-ghost btn-xs w-8 h-8 p-0 rounded-lg">
              <i class="fa-solid fa-xmark" />
            </button>
          </div>

          <!-- Modal body -->
          <div class="p-6">
            <form @submit.prevent="guardar" class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <label class="label">Nombre / Razón social *</label>
                <input v-model="form.nombres" required type="text" class="input" />
              </div>
              <div>
                <label class="label">Nombre comercial</label>
                <input v-model="form.nom_comercial" type="text" class="input" />
              </div>
              <div>
                <label class="label">NIT</label>
                <input v-model="form.nit" type="text" class="input" />
              </div>
              <div>
                <label class="label">Registro IVA</label>
                <input v-model="form.registro_iva" type="text" class="input" />
              </div>
              <div>
                <label class="label">Email</label>
                <input v-model="form.email" type="email" class="input" />
              </div>
              <div>
                <label class="label">Teléfono</label>
                <input v-model="form.telefono" type="text" class="input" />
              </div>
              <div class="col-span-2">
                <label class="label">Dirección</label>
                <input v-model="form.direccion" type="text" class="input" />
              </div>

              <div class="col-span-2">
                <label class="label">Catálogo de precios</label>
                <select v-model="form.catalogo_precio_id" class="input">
                  <option :value="null">— Sin catálogo asignado —</option>
                  <option v-for="cat in catalogos" :key="cat.id" :value="cat.id">{{ cat.nombre }}</option>
                </select>
                <p class="text-[11px] text-stone-500 mt-1">Define qué tarifa de precios aplica al generar órdenes para este cliente.</p>
              </div>

              <div class="col-span-2 pt-1 border-t border-stone-800">
                <p class="text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-3">Condiciones de crédito</p>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="label">Límite de crédito ($)</label>
                    <div class="relative">
                      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs">$</span>
                      <input v-model.number="form.limite_credito" type="number" min="0" step="0.01" class="input pl-6" />
                    </div>
                  </div>
                  <div>
                    <label class="label">Plazo (días)</label>
                    <input v-model.number="form.plazo_credito" type="number" min="0" class="input" />
                  </div>
                </div>
              </div>

              <div class="col-span-2 flex items-center gap-2.5">
                <input v-model="form.exento" type="checkbox" id="exento"
                  class="w-4 h-4 rounded bg-stone-800 border-stone-600 text-amber-500 focus:ring-amber-500 focus:ring-offset-stone-900" />
                <label for="exento" class="text-sm text-stone-300 cursor-pointer">Exento de IVA</label>
              </div>

              <div class="col-span-2 flex justify-end gap-3 pt-2 border-t border-stone-800">
                <button type="button" @click="showModal = false" class="btn btn-secondary">Cancelar</button>
                <button type="submit" :disabled="saving" class="btn btn-primary">
                  <i v-if="saving" class="fa-solid fa-circle-notch fa-spin" />
                  {{ saving ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear cliente') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ── Modal documentos de cliente ────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showDocModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
        @click.self="showDocModal = false">
        <div class="bg-stone-900 border border-stone-700/60 rounded-2xl shadow-2xl w-full max-w-md animate-slide-in">

          <div class="flex items-center justify-between px-6 py-4 border-b border-stone-800">
            <div>
              <h3 class="font-bold text-neutral-100">Documentos</h3>
              <p class="text-xs text-stone-500 mt-0.5 truncate max-w-[260px]">{{ docClienteNombre }}</p>
            </div>
            <button @click="showDocModal = false" class="btn btn-ghost btn-xs w-8 h-8 p-0 rounded-lg">
              <i class="fa-solid fa-xmark" />
            </button>
          </div>

          <div class="p-6 space-y-4">
            <!-- Subir nuevo -->
            <div class="bg-stone-800/40 border border-stone-700/40 rounded-xl p-4 space-y-3">
              <p class="text-xs font-semibold text-stone-400 uppercase tracking-wide">Subir documento</p>
              <div>
                <label class="label text-xs">Tipo</label>
                <select v-model="docForm.tipo" class="select text-sm">
                  <option value="tarjeta_iva">Tarjeta IVA</option>
                  <option value="carta_exencion">Carta de exención</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label class="label text-xs">Archivo (PDF, JPG, PNG)</label>
                <input @change="onArchivoChange" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                  class="block w-full text-sm text-stone-400
                    file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
                    file:text-xs file:font-semibold file:bg-stone-700 file:text-stone-200
                    hover:file:bg-stone-600 cursor-pointer" />
              </div>
              <button @click="subirDocumento" :disabled="savingDoc || !docForm.archivo"
                class="w-full py-2 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white transition-all flex items-center justify-center gap-2">
                <i v-if="savingDoc" class="fa-solid fa-circle-notch fa-spin text-xs" />
                <i v-else class="fa-solid fa-cloud-arrow-up text-xs" />
                {{ savingDoc ? 'Subiendo...' : 'Subir' }}
              </button>
            </div>

            <!-- Listado -->
            <div v-if="loadingDocs" class="text-center py-6 text-stone-500 text-sm">
              <i class="fa-solid fa-circle-notch fa-spin mr-2" />Cargando...
            </div>
            <div v-else-if="!documentos.length" class="text-center py-6 text-stone-600 text-sm">
              <i class="fa-solid fa-file-slash text-2xl mb-2 block opacity-30" />
              Sin documentos adjuntos
            </div>
            <div v-else class="space-y-2">
              <div v-for="doc in documentos" :key="doc.id"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-stone-800/40 border border-stone-700/30">
                <i class="fa-solid fa-file-lines text-amber-500/80 flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-neutral-200 truncate">{{ doc.nombre_archivo }}</div>
                  <div class="text-[10px] text-stone-500">{{ TIPO_DOC_LABELS[doc.tipo] ?? doc.tipo }}</div>
                </div>
                <button @click="descargarDoc(doc.id)" title="Ver / descargar"
                  class="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-amber-400 hover:bg-stone-700 transition-colors">
                  <i class="fa-solid fa-arrow-down-to-line text-xs" />
                </button>
                <button @click="eliminarDoc(doc.id)" title="Eliminar"
                  class="w-7 h-7 rounded-lg flex items-center justify-center text-stone-600 hover:text-red-400 hover:bg-red-900/20 transition-colors">
                  <i class="fa-solid fa-trash text-xs" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
