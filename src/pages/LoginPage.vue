<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api, { setSession } from '../services/api.js'

const router   = useRouter()
const form     = ref({ username: '', password: '' })
const error    = ref('')
const loading  = ref(false)
const showPass = ref(false)
const year     = new Date().getFullYear()

async function login() {
  error.value = ''
  loading.value = true
  try {
    const { data } = await api.post('auth/login', form.value)
    setSession(data)
    router.push('/dashboard')
  } catch (e) {
    error.value = e.response?.data?.message || 'Credenciales incorrectas.'
  } finally {
    loading.value = false
  }
}

function fill(username) {
  form.value.username = username
  form.value.password = 'cadejo2026'
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-neutral-950 via-stone-900 to-neutral-950 flex items-center justify-center px-4">
    <div class="w-full max-w-md animate-slide-in">

      <!-- Logo -->
      <div class="flex flex-col items-center mb-8">
        <img src="https://cadejo-storage.s3.us-east-2.amazonaws.com/public/logo2.png"
             class="w-20 h-20 object-contain mb-3" alt="Cadejo Brewing Company" />
        <h1 class="text-2xl font-bold text-amber-400 tracking-wide">Cadejo Brewing Company</h1>
        <p class="text-stone-400 text-sm mt-1">Plataforma de Ventas Externas</p>
      </div>

      <!-- Card -->
      <div class="bg-stone-900 border border-amber-800/30 rounded-2xl shadow-2xl p-8">
        <h2 class="text-xl font-semibold text-neutral-100 mb-6 text-center">Iniciar sesión</h2>

        <form @submit.prevent="login" novalidate class="space-y-4">
          <div>
            <label class="label">Usuario</label>
            <input v-model="form.username" type="text" required autocomplete="username"
              placeholder="username" class="input" />
          </div>

          <div>
            <label class="label">Contraseña</label>
            <div class="relative">
              <input v-model="form.password" :type="showPass ? 'text' : 'password'" required
                autocomplete="current-password" placeholder="••••••••" class="input pr-10" />
              <button type="button" @click="showPass = !showPass" tabindex="-1"
                class="absolute inset-y-0 right-0 px-3 flex items-center text-stone-400 hover:text-amber-400 transition">
                <i :class="showPass ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'" />
              </button>
            </div>
          </div>

          <div v-if="error" class="bg-red-900/40 border border-red-700/50 rounded-lg px-4 py-3 text-red-300 text-sm">
            {{ error }}
          </div>

          <button type="submit" :disabled="loading"
            class="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-800 disabled:cursor-not-allowed text-stone-950 font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2">
            <i v-if="loading" class="fa-solid fa-circle-notch fa-spin" />
            {{ loading ? 'Ingresando...' : 'Ingresar' }}
          </button>
        </form>

        <!-- Credenciales de prueba -->
        <div class="mt-5 pt-4 border-t border-stone-800">
          <p class="text-xs text-stone-500 mb-2 text-center">Credenciales de prueba</p>
          <div class="flex gap-2">
            <button type="button" @click="fill('vendedor')"
              class="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-amber-600/50 rounded-lg transition-all text-xs text-stone-300 hover:text-amber-300">
              <i class="fa-solid fa-user text-stone-500" />
              Vendedor
            </button>
            <button type="button" @click="fill('rodrigo')"
              class="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-amber-600/50 rounded-lg transition-all text-xs text-stone-300 hover:text-amber-300">
              <i class="fa-solid fa-user-tie text-stone-500" />
              Jefe de Ventas
            </button>
          </div>
        </div>
      </div>

      <p class="text-center text-stone-600 text-xs mt-6">&copy; {{ year }} Cadejo Brewing Company</p>
    </div>
  </div>
</template>
