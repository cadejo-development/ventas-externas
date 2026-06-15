<script setup>
import { ref } from 'vue'

const toasts = ref([])

let nextId = 0

export function useToast() {
  function push(msg, type = 'success', duration = 3500) {
    const id = ++nextId
    toasts.value.push({ id, msg, type })
    setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, duration)
  }
  return { push }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      <TransitionGroup name="toast">
        <div v-for="t in toasts" :key="t.id"
          class="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium pointer-events-auto max-w-sm"
          :class="{
            'bg-green-900/90 border border-green-700/60 text-green-200': t.type === 'success',
            'bg-red-900/90 border border-red-700/60 text-red-200':     t.type === 'error',
            'bg-amber-900/90 border border-amber-700/60 text-amber-200': t.type === 'warning',
            'bg-stone-800/90 border border-stone-600/60 text-stone-200': t.type === 'info',
          }">
          <i :class="{
            'fa-solid fa-check-circle text-green-400': t.type === 'success',
            'fa-solid fa-circle-xmark text-red-400':   t.type === 'error',
            'fa-solid fa-triangle-exclamation text-amber-400': t.type === 'warning',
            'fa-solid fa-circle-info text-stone-400':  t.type === 'info',
          }" />
          {{ t.msg }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from { opacity: 0; transform: translateX(20px); }
.toast-leave-to   { opacity: 0; transform: translateX(20px); }
</style>
