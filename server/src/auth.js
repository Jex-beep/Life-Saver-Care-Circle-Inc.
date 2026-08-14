import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

export function signAdminToken(admin) {
  return jwt.sign(
    {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      branch_id: admin.branch_id,
      display_name: admin.display_name,
    },
    SECRET,
    { expiresIn: '12h' }
  )
}

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not logged in' })
  try {
    req.admin = jwt.verify(token, SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Session expired, please log in again' })
  }
}

export function requireSuper(req, res, next) {
  if (req.admin?.role !== 'super') {
    return res.status(403).json({ error: 'Corporate admin access required' })
  }
  next()
}

/* Stocking medicines in is the manager's job — handlers can only sell stock down. */
export function requireManager(req, res, next) {
  if (req.admin?.role !== 'super' && req.admin?.role !== 'manager') {
    return res.status(403).json({ error: 'Only the branch manager can change what medicines this branch carries' })
  }
  next()
}

export const isSuper = (req) => req.admin?.role === 'super'

/* Branch staff may only touch their own branch; super admins may pass any branch id. */
export function scopedBranchId(req, requestedId) {
  if (isSuper(req)) return requestedId ?? null
  return req.admin.branch_id
}
