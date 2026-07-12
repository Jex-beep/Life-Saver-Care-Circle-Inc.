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

/* ---------- Capacity blocks (per-date booking limits) ---------- */

router.get('/capacity-blocks', async (req, res) => {
  const branchId = scopedBranchId(req, req.query.branch_id ? Number(req.query.branch_id) : null)
  if (!branchId) return res.status(400).json({ error: 'branch_id is required' })
  const from = req.query.from || new Date().toISOString().slice(0, 10)
  const to = req.query.to || null

  let q = db
    .from('capacity_blocks')
    .select('*')
    .eq('branch_id', branchId)
    .gte('block_date', from)
    .order('block_date')
    .order('start_time')
  if (to) q = q.lte('block_date', to)
  const { data: blocks, error } = await q
  if (error) {
    if (/capacity_blocks/.test(error.message)) {
      return res.status(503).json({
        error: 'Capacity blocks are not set up yet — run supabase/migration-002-capacity-blocks.sql in the Supabase SQL Editor.',
      })
    }
    return res.status(500).json({ error: error.message })
  }

  /* attach booked counts per block */
  const dates = [...new Set(blocks.map((b) => b.block_date))]
  let bookings = []
  if (dates.length > 0) {
    const { data } = await db
      .from('bookings')
      .select('booking_date, booking_time')
      .eq('branch_id', branchId)
      .in('booking_date', dates)
      .neq('status', 'cancelled')
    bookings = data || []
  }
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  const withCounts = blocks.map((b) => {
    const booked = bookings.filter(
      (x) =>
        x.booking_date === b.block_date &&
        toMin(x.booking_time) >= toMin(b.start_time) &&
        toMin(x.booking_time) < toMin(b.end_time)
    ).length
    return { ...b, booked, remaining: Math.max(0, b.max_patients - booked) }
  })
  res.json(withCounts)
})

router.post('/capacity-blocks', async (req, res) => {
  const branchId = scopedBranchId(req, req.body?.branch_id ? Number(req.body.branch_id) : null)
  if (!branchId) return res.status(400).json({ error: 'branch_id is required' })
  const { block_date, start_time, end_time, max_patients, note } = req.body || {}
  if (!block_date || !start_time || !end_time || max_patients === undefined) {
    return res.status(400).json({ error: 'block_date, start_time, end_time, and max_patients are required' })
  }
  if (end_time <= start_time) return res.status(400).json({ error: 'End time must be after start time' })
  const max = Number(max_patients)
  if (!Number.isInteger(max) || max < 0 || max > 500) {
    return res.status(400).json({ error: 'max_patients must be a whole number between 0 and 500' })
  }

  const { data, error } = await db
    .from('capacity_blocks')
    .insert({ branch_id: branchId, block_date, start_time, end_time, max_patients: max, note: note || '' })
    .select()
    .single()
  if (error) {
    if (/capacity_blocks/.test(error.message)) {
      return res.status(503).json({
        error: 'Capacity blocks are not set up yet — run supabase/migration-002-capacity-blocks.sql in the Supabase SQL Editor.',
      })
    }
    return res.status(500).json({ error: error.message })
  }
  res.status(201).json(data)
})

router.delete('/capacity-blocks/:id', async (req, res) => {
  let q = db.from('capacity_blocks').delete().eq('id', Number(req.params.id))
  if (req.admin.role !== 'super') q = q.eq('branch_id', req.admin.branch_id)
  const { data, error } = await q.select('id').maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Block not found for your branch' })
  res.json({ deleted: data.id })
})

/* ============================================================
   Corporate (super admin) only below
   ============================================================ */

router.use(requireSuper)

/* ---------- Announcements CRUD (superadmin) ---------- */

const ANN_MIGRATION_HINT =
  'Announcements are not set up yet — run supabase/migration-003-announcements.sql in the Supabase SQL Editor.'

router.get('/announcements', async (_req, res) => {
  const { data, error } = await db
    .from('announcements')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
  if (error) {
    if (/announcements/.test(error.message)) return res.status(503).json({ error: ANN_MIGRATION_HINT })
    return res.status(500).json({ error: error.message })
  }
  res.json(data)
})

router.post('/announcements', async (req, res) => {
  const { title, body, category, is_published, is_pinned } = req.body || {}
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' })
  const cat = ['news', 'hiring', 'advisory'].includes(category) ? category : 'news'

  if (is_pinned) await db.from('announcements').update({ is_pinned: false }).eq('is_pinned', true)

  const { data, error } = await db
    .from('announcements')
    .insert({
      title: title.trim(),
      body: body || '',
      category: cat,
      is_published: is_published !== false,
      is_pinned: !!is_pinned,
    })
    .select()
    .single()
  if (error) {
    if (/announcements/.test(error.message)) return res.status(503).json({ error: ANN_MIGRATION_HINT })
    return res.status(500).json({ error: error.message })
  }
  res.status(201).json(data)
})

router.patch('/announcements/:id', async (req, res) => {
  const updates = {}
  if (req.body?.title !== undefined) updates.title = String(req.body.title).trim()
  if (req.body?.body !== undefined) updates.body = req.body.body
  if (req.body?.category !== undefined && ['news', 'hiring', 'advisory'].includes(req.body.category))
    updates.category = req.body.category
  if (req.body?.is_published !== undefined) updates.is_published = !!req.body.is_published
  if (req.body?.is_pinned !== undefined) updates.is_pinned = !!req.body.is_pinned
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' })

  if (updates.is_pinned === true) await db.from('announcements').update({ is_pinned: false }).eq('is_pinned', true)

  const { data, error } = await db
    .from('announcements')
    .update(updates)
    .eq('id', Number(req.params.id))
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.delete('/announcements/:id', async (req, res) => {
  const { data, error } = await db
    .from('announcements')
    .delete()
    .eq('id', Number(req.params.id))
    .select('id')
    .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Announcement not found' })
  res.json({ deleted: data.id })
})

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
