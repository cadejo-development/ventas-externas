import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/cadejo-ventas',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
})

api.interceptors.request.use(config => {
  const session = getSession()
  if (session?.token) {
    config.headers.Authorization = `Bearer ${session.token}`
  }
  return config
})

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem('cv_session') || 'null')
  } catch { return null }
}

export function setSession(data) {
  localStorage.setItem('cv_session', JSON.stringify(data))
}

export function clearSession() {
  localStorage.removeItem('cv_session')
}

export default api
