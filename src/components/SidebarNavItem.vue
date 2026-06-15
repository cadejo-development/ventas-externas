<template>
  <RouterLink :to="to"
    class="flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-150 group"
    :class="isActive
      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm shadow-amber-900/20'
      : 'text-stone-500 hover:text-stone-200 hover:bg-stone-800/60 border border-transparent'"
  >
    <i :class="[icon, 'w-4 text-center text-sm flex-shrink-0 transition-colors',
        isActive ? 'text-amber-400' : 'text-stone-600 group-hover:text-stone-400']" />
    <span class="flex-1 font-medium truncate"><slot /></span>
  </RouterLink>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  to:   { type: String, required: true },
  icon: { type: String, default: '' },
})

const route    = useRoute()
const isActive = computed(() => route.path === props.to || route.path.startsWith(props.to + '/'))
</script>
