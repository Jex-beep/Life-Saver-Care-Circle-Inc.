import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../supabase.js'
import { signAdminToken, requireAdmin, requireSuper, scopedBranchId } from '../auth.js'
import { localDateStr } from '../helpers.js'

const router = Router()

/* ---------- Login ---------- */

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' })

  const { data: admin, error } = await db
    .from('admins')
    .select('*, branches(name)')
    .eq('username', username.toLowerCase().trim())
    .eq('is_active', true)
    .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' })
  }

  res.json({
    token: signAdminToken(admin),
    admin: {
      username: admin.username,
      display_name: admin.display_name,
      role: admin.role,
      branch_id: admin.branch_id,
      branch_name: admin.branches?.name || null,
    },
  })
})

router.use(requireAdmin)

/* ---------- Dashboard summary ---------- */

router.get('/summary', async (req, res) => {
  const branchId = scopedBranchId(req, req.query.branch_id ? Number(req.query.branch_id) : null)
  const today = localDateStr()

  let bookingsQ = db
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('booking_date', today)
    .neq('status', 'cancelled')
  let ordersQ = db
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .in('status', ['placed', 'preparing'])
  let verifyQ = db
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('payment_status', 'for_verification')
  if (branchId) {
    bookingsQ = bookingsQ.eq('branch_id', branchId)
    ordersQ = ordersQ.eq('branch_id', branchId)
    verifyQ = verifyQ.eq('branch_id', branchId)
  }
  const [{ count: todayBookings }, { count: openOrders }, { count: paymentsToVerify }] = await Promise.all([
    bookingsQ,
    ordersQ,
    verifyQ,
  ])
  res.json({ todayBookings: todayBookings || 0, openOrders: openOrders || 0, paymentsToVerify: paymentsToVerify || 0 })
})

/* ---------- Bookings ---------- */

router.get('/bookings', async (req, res) => {
  const branchId = scopedBranchId(req, req.query.branch_id ? Number(req.query.branch_id) : null)
  let q = db
    .from('bookings')
    .select('*, branches(name), services(name)')
    .order('booking_date', { ascending: false })
    .order('booking_time')
    .limit(200)
  if (branchId) q = q.eq('branch_id', branchId)
  if (req.query.date) q = q.eq('booking_date', req.query.date)
  if (req.query.status) q = q.eq('status', req.query.status)
  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.patch('/bookings/:id', async (req, res) => {
  const allowed = ['confirmed', 'completed', 'cancelled', 'no_show']
  if (!allowed.includes(req.body?.status)) return res.status(400).json({ error: 'Invalid status' })

  let q = db.from('bookings').update({ status: req.body.status }).eq('id', Number(req.params.id))
  if (req.admin.role !== 'super') q = q.eq('branch_id', req.admin.branch_id)
  const { data, error } = await q.select('id, status').maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Booking not found for your branch' })
  res.json(data)
})

/* ---------- Orders ---------- */

router.get('/orders', async (req, res) => {
  const branchId = scopedBranchId(req, req.query.branch_id ? Number(req.query.branch_id) : null)
  let q = db.from('orders').select('*, branches(name)').order('created_at', { ascending: false }).limit(200)
  if (branchId) q = q.eq('branch_id', branchId)
  if (req.query.status) q = q.eq('status', req.query.status)
  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.patch('/orders/:id', async (req, res) => {
  const updates = {}
  if (req.body?.status) {
    if (!['placed', 'preparing', 'ready', 'completed', 'cancelled'].includes(req.body.status))
      return res.status(400).json({ error: 'Invalid status' })
    updates.status = req.body.status
  }
  if (req.body?.payment_status) {
    if (!['unpaid', 'for_verification', 'paid'].includes(req.body.payment_status))
      return res.status(400).json({ error: 'Invalid payment status' })
    updates.payment_status = req.body.payment_status
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' })

  let q = db.from('orders').update(updates).eq('id', Number(req.params.id))
  if (req.admin.role !== 'super') q = q.eq('branch_id', req.admin.branch_id)
  const { data, error } = await q.select('id, status, payment_status').maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Order not found for your branch' })
  res.json(data)
})

/* ---------- Branch schedule ---------- */

router.get('/schedule', async (req, res) => {
  const branchId = scopedBranchId(req, req.query.branch_id ? Number(req.query.branch_id) : null)
  if (!branchId) return res.status(400).json({ error: 'branch_id is required' })
  const { data, error } = await db.from('branch_schedules').select('*').eq('branch_id', branchId).order('weekday')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.put('/schedule/:weekday', async (req, res) => {
  const branchId = scopedBranchId(req, req.body?.branch_id ? Number(req.body.branch_id) : null)
  if (!branchId) return res.status(400).json({ error: 'branch_id is required' })
  const weekday = Number(req.params.weekday)
  const { open_time, close_time, slot_minutes, capacity, is_open } = req.body || {}

  const { data, error } = await db
    .from('branch_schedules')
    .upsert(
      { branch_id: branchId, weekday, open_time, close_time, slot_minutes, capacity, is_open },
      { onConflict: 'branch_id,weekday' }
    )
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

/* ---------- Branch payment settings (GCash / QRPh) ---------- */

router.get('/branch-settings', async (req, res) => {
  const branchId = scopedBranchId(req, req.query.branch_id ? Number(req.query.branch_id) : null)
  if (!branchId) return res.status(400).json({ error: 'branch_id is required' })
  const { data, error } = await db
    .from('branches')
    .select('id, name, address, phone, gcash_number, qr_image_url')
    .eq('id', branchId)
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.patch('/branch-settings', async (req, res) => {
  const branchId = scopedBranchId(req, req.body?.branch_id ? Number(req.body.branch_id) : null)
  if (!branchId) return res.status(400).json({ error: 'branch_id is required' })
  const { address, phone, gcash_number, qr_image_url } = req.body || {}
  const updates = {}
  if (address !== undefined) updates.address = address
  if (phone !== undefined) updates.phone = phone
  if (gcash_number !== undefined) updates.gcash_number = gcash_number
  if (qr_image_url !== undefined) updates.qr_image_url = qr_image_url
  const { data, error } = await db.from('branches').update(updates).eq('id', branchId).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

/* ============================================================
   Corporate (super admin) only below
   ============================================================ */

router.use(requireSuper)

/* ---------- Branches CRUD ---------- */

router.get('/branches', async (_req, res) => {
  const { data, error } = await db.from('branches').select('*').order('area').order('name')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/branches', async (req, res) => {
  const { data, error } = await db.from('branches').insert(req.body).select().single()
  if (error) return res.status(500).json({ error: error.message })
  // give the new branch a default Mon-Sat schedule
  const rows = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    branch_id: data.id,
    weekday,
    is_open: weekday !== 0,
  }))
  await db.from('branch_schedules').insert(rows)
  res.status(201).json(data)
})

router.patch('/branches/:id', async (req, res) => {
  const { data, error } = await db.from('branches').update(req.body).eq('id', Number(req.params.id)).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

/* ---------- Services CRUD ---------- */

router.get('/services', async (_req, res) => {
  const { data, error } = await db.from('services').select('*').order('sort_order')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/services', async (req, res) => {
  const { data, error } = await db.from('services').insert(req.body).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

router.patch('/services/:id', async (req, res) => {
  const { data, error } = await db.from('services').update(req.body).eq('id', Number(req.params.id)).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

/* ---------- Products CRUD ---------- */

router.get('/products', async (_req, res) => {
  const { data, error } = await db.from('products').select('*').order('category').order('name')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/products', async (req, res) => {
  const { data, error } = await db.from('products').insert(req.body).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

router.patch('/products/:id', async (req, res) => {
  const { data, error } = await db.from('products').update(req.body).eq('id', Number(req.params.id)).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

/* ---------- Admin accounts CRUD ---------- */

router.get('/admins', async (_req, res) => {
  const { data, error } = await db
    .from('admins')
    .select('id, username, display_name, role, branch_id, is_active, branches(name)')
    .order('role')
    .order('username')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/admins', async (req, res) => {
  const { username, password, display_name, role, branch_id } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' })
  if (role === 'branch' && !branch_id) return res.status(400).json({ error: 'Branch admins need a branch_id' })
  const { data, error } = await db
    .from('admins')
    .insert({
      username: username.toLowerCase().trim(),
      password_hash: bcrypt.hashSync(password, 10),
      display_name: display_name || username,
      role: role === 'super' ? 'super' : 'branch',
      branch_id: role === 'super' ? null : branch_id,
    })
    .select('id, username, display_name, role, branch_id')
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

router.patch('/admins/:id', async (req, res) => {
  const updates = {}
  if (req.body?.password) updates.password_hash = bcrypt.hashSync(req.body.password, 10)
  if (req.body?.display_name !== undefined) updates.display_name = req.body.display_name
  if (req.body?.is_active !== undefined) updates.is_active = req.body.is_active
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' })
  const { data, error } = await db
    .from('admins')
    .update(updates)
    .eq('id', Number(req.params.id))
    .select('id, username, is_active')
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

export default router
