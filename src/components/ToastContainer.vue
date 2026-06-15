<script setup>
import { useToast } from '../composables/useToast.js'
const { toasts } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      <TransitionGroup name="toast">
        <div v-for="t in toasts" :key="t.id"
          class="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium pointer-events-auto max-w-sm backdrop-blur-sm"
          :class="{
            'bg-green-900/95 border border-green-700/60 text-green-100': t.type === 'success',
            'bg-red-900/95 border border-red-700/60 text-red-100':       t.type === 'error',
            'bg-amber-900/95 border border-amber-700/60 text-amber-100': t.type === 'warning',
            'bg-stone-800/95 border border-stone-600/60 text-stone-100': t.type === 'info',
          }">
          <i :class="{
            'fa-solid fa-check-circle text-green-400': t.type === 'success',
            'fa-solid fa-circle-xmark text-red-400':   t.type === 'error',
            'fa-solid fa-triangle-exclamation text-amber-400': t.type === 'warning',
            'fa-solid fa-circle-info text-blue-400':   t.type === 'info',
          }" />
          <span>{{ t.msg }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.25s cubic-bezier(0.4,0,0.2,1); }
.toast-enter-from { opacity: 0; transform: translateX(16px) scale(0.95); }
.toast-leave-to   { opacity: 0; transform: translateX(16px) scale(0.95); }
</style>
