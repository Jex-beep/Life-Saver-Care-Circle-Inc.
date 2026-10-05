const BASE = '/api'
 
async function request(path, { method = 'GET', body, token } = {}) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Cannot reach the server. Is the backend running? (npm run dev inside /server)')
  }
 
  const contentType = res.headers.get('content-type') || ''
  let data = null
  let parseFailed = false
  if (contentType.includes('application/json')) {
    try {
      data = await res.json()
    } catch {
      parseFailed = true
    }
  } else {
    parseFailed = true
  }
 
  if (res.status === 502 || res.status === 504) {
    throw new Error('The server is not running yet. Start it with "npm run dev" inside the /server folder.')
  }
 
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
 
  /* A 2xx response that isn't actually JSON (e.g. the frontend's own index.html
     coming back instead of the API) means /api/* isn't reaching the backend at
     all — surface this clearly instead of silently returning null. */
  if (parseFailed) {
    throw new Error(
      `Got a non-JSON response from ${BASE}${path} — the request likely isn't reaching the backend server. Check your API routing/proxy configuration.`
    )
  }
 
  return data
}
 
export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
}
 
const TOKEN_KEY = 'ls_admin_session'
 
export function getAdminSession() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY)) || null
  } catch {
    return null
  }
}
 
export function setAdminSession(session) {
  if (session) localStorage.setItem(TOKEN_KEY, JSON.stringify(session))
  else localStorage.removeItem(TOKEN_KEY)
}
 
function adminRequest(path, opts = {}) {
  const session = getAdminSession()
  return request(`/admin${path}`, { ...opts, token: session?.token })
}
 
export const adminApi = {
  login: (username, password) => request('/admin/login', { method: 'POST', body: { username, password } }),
  get: (path) => adminRequest(path),
  post: (path, body) => adminRequest(path, { method: 'POST', body }),
  patch: (path, body) => adminRequest(path, { method: 'PATCH', body }),
  put: (path, body) => adminRequest(path, { method: 'PUT', body }),
  delete: (path) => adminRequest(path, { method: 'DELETE' }),
}
 
export const peso = (n) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(n) || 0)