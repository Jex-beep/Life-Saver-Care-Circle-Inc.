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
  let data = null
  try {
    data = await res.json()
  } catch {
    /* empty body */
  }
  if (res.status === 502 || res.status === 504) {
    throw new Error('The server is not running yet. Start it with "npm run dev" inside the /server folder (see README for Supabase setup).')
  }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
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
}

export const peso = (n) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(n) || 0)
