<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../../services/api.js'
import PageHeader from '../../components/PageHeader.vue'

const productos = ref([])
const loading   = ref(true)
const search    = ref('')
const filtroBodega = ref('')

const bodegas = [
  { id: 59, label: 'Prod. Term. Cadejo' },
  { id: 60, label: 'Prod. Term. Sivar' },
  { id: 62, label: 'Promocionales' },
]

onMounted(async () => {
  try { const { data } = await api.get('productos'); productos.value = data }
  catch (e) { console.error(e) }
  finally { loading.value = false }
})

const filtrados = computed(() => {
  let list = productos.value
  if (filtroBodega.value) list = list.filter(p => p.bodega_id == filtroBodega.value)
  if (search.value.trim()) {
    const s = search.value.toLowerCase()
    list = list.filter(p => p.nombre.toLowerCase().includes(s) || (p.codigo || '').toLowerCase().includes(s))
  }
  return list
})

const grupos = computed(() => {
  const map = {}
  filtrados.value.forEach(p => {
    const k = p.bodega || 'Sin bodega'
    if (!map[k]) map[k] = []
    map[k].push(p)
  })
  return map
})

function stockClass(n) {
  if (n <= 0) return 'text-red-400'
  if (n < 50) return 'text-amber-400'
  return 'text-emerald-400'
}
</script>

<template>
  <div>
    <PageHeader title="Productos" :subtitle="`${filtrados.length} productos disponibles`" />

    <!-- Filtros -->
    <div class="flex flex-wrap gap-3 mb-5 items-center">
      <div class="flex gap-1 bg-stone-800 rounded-lg p-1">
        <button :class="['px-3 py-1.5 rounded text-xs font-medium transition', !filtroBodega ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-200']"
          @click="filtroBodega = ''">Todas</button>
        <button v-for="b in bodegas" :key="b.id"
          :class="['px-3 py-1.5 rounded text-xs font-medium transition', filtroBodega == b.id ? 'bg-amber-600 text-white' : 'text-stone-400 hover:text-stone-200']"
          @click="filtroBodega = b.id">{{ b.label }}</button>
      </div>
      <input v-model="search" type="text" placeholder="Buscar por nombre o código..." class="input md:w-64" />
    </div>

    <!-- Skeleton -->
    <div v-if="loading" class="table-wrapper">
      <div v-for="i in 10" :key="i" class="flex gap-4 px-4 py-3 border-b border-stone-800 animate-pulse">
        <div class="h-3 bg-stone-800 rounded w-24" /><div class="h-3 bg-stone-800 rounded flex-1" />
        <div class="h-3 bg-stone-800 rounded w-12" /><div class="h-3 bg-stone-800 rounded w-16" />
      </div>
    </div>

    <template v-else>
      <div v-if="filtrados.length === 0" class="table-wrapper py-16 text-center text-stone-500">
        <i class="fa-solid fa-box text-3xl text-stone-700 mb-3 block" />
        No se encontraron productos
      </div>

      <div v-for="(items, bodega) in grupos" :key="bodega" class="mb-6">
        <div class="flex items-center gap-2 mb-2">
          <i class="fa-solid fa-warehouse text-xs text-amber-700/80" />
          <span class="text-[10px] font-bold uppercase tracking-widest text-stone-500">{{ bodega }}</span>
          <span class="text-[10px] text-stone-600">({{ items.length }})</span>
        </div>
        <div class="table-wrapper overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th class="text-center">IVA</th>
                <th class="text-right">Precio</th>
                <th class="text-right">Existencias</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in items" :key="p.id">
                <td class="px-4 py-2.5 font-mono text-xs text-amber-300">{{ p.codigo || '—' }}</td>
                <td class="px-4 py-2.5 font-medium text-neutral-100">{{ p.nombre }}</td>
                <td class="px-4 py-2.5 text-center">
                  <span v-if="p.exento" class="badge badge-stone">Exento</span>
                  <span v-else class="badge badge-blue">13%</span>
                </td>
                <td class="px-4 py-2.5 text-right tabular-nums">
                  <span :class="p.precio ? 'text-emerald-400 font-semibold' : 'text-stone-500'">
                    {{ p.precio != null ? `$${Number(p.precio).toFixed(2)}` : '—' }}
                  </span>
                </td>
                <td class="px-4 py-2.5 text-right tabular-nums font-semibold" :class="stockClass(p.existencias)">
                  {{ p.existencias.toLocaleString() }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
