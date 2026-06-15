import { ref } from 'vue'

const toasts = ref([])
let nextId = 0

export function useToast() {
  function push(msg, type = 'success', duration = 3500) {
    const id = ++nextId
    toasts.value.push({ id, msg, type })
    setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, duration)
  }
  return { toasts, push }
}
