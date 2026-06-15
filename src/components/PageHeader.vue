<template>
  <div class="mb-6">
    <div class="flex items-center gap-4">
      <h1 class="text-3xl font-bold text-amber-400 leading-tight tracking-tight">{{ title }}</h1>
      <slot name="actions" />
    </div>
    <div v-if="subtitle" class="text-stone-400 text-sm mt-1">{{ subtitle }}</div>
  </div>
</template>

<script setup>
defineProps({
  title:    { type: String, default: '' },
  subtitle: { type: String, default: '' },
})
</script>
