import axios from 'axios'
import { getFirebaseAuth } from '../config/firebase.js'

const baseURL =
  import.meta.env.VITE_API_BASE_URL === undefined ||
  import.meta.env.VITE_API_BASE_URL === ''
    ? ''
    : import.meta.env.VITE_API_BASE_URL

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(async (config) => {
  // Default Content-Type is application/json; FormData must stay multipart or axios
  // stringifies the body and File becomes {}.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    const h = config.headers
    if (h && typeof h.delete === 'function') {
      h.delete('Content-Type')
    } else if (h) {
      delete h['Content-Type']
    }
  }

  const auth = getFirebaseAuth()
  const user = auth?.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
