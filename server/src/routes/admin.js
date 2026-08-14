import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../supabase.js'
import { signAdminToken, requireAdmin, requireSuper, requireManager, isSuper, scopedBranchId } from '../auth.js'
import { localDateStr } from '../helpers.js'
import { parseMapEmbed } from '../maps.js'

const router = Router()

const INVENTORY_MIGRATION_HINT =
  'Medicine stock is not set up yet — run supabase/migration-004-inventory-roles-maps.sql in the Supabase SQL Editor.'

/* migration 004 adds branch_inventory, stock_movements, and adjust_stock() */
function isMissingInventory(error) {
  return /branch_inventory|stock_movements|adjust_stock/.test(error?.message || '')
}

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

  /* Cancelling puts the medicines back on the shelf. Read the order first so
     we know what to return, and only return it if it wasn't already cancelled. */
  let previous = null
  if (updates.status === 'cancelled') {
    const { data: existing } = await db
      .from('orders')
      .select('id, branch_id, status, items, reference')
      .eq('id', Number(req.params.id))
      .maybeSingle()
    previous = existing
  }

  let q = db.from('orders').update(updates).eq('id', Number(req.params.id))
  if (!isSuper(req)) q = q.eq('branch_id', req.admin.branch_id)
  const { data, error } = await q.select('id, status, payment_status').maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Order not found for your branch' })

  if (previous && previous.status !== 'cancelled' && Array.isArray(previous.items)) {
    for (const item of previous.items) {
      await db.rpc('adjust_stock', {
        p_branch_id: previous.branch_id,
        p_product_id: item.product_id,
        p_delta: Number(item.qty) || 0,
        p_reason: 'returned',
        p_note: 'Order cancelled',
        p_order_reference: previous.reference || '',
        p_admin_id: req.admin.id,
      })
    }
  }

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
   Medicine stock — each branch keeps its own

   manager : decides what this branch carries and stocks it in
   handler : rings up walk-in sales, which takes stock down
   super   : may do either, for any branch
   ============================================================ */

/* ---------- What this branch carries ---------- */

router.get('/inventory', async (req, res) => {
  const branchId = scopedBranchId(req, req.query.branch_id ? Number(req.query.branch_id) : null)
  if (!branchId) return res.status(400).json({ error: 'branch_id is required' })

  const { data, error } = await db
    .from('branch_inventory')
    .select('id, branch_id, product_id, stock, low_stock_at, is_available, updated_at, products(name, generic_name, category, price, requires_rx, is_active)')
    .eq('branch_id', branchId)
  if (error) {
    if (isMissingInventory(error)) return res.status(503).json({ error: INVENTORY_MIGRATION_HINT })
    return res.status(500).json({ error: error.message })
  }

  const rows = data
    .map((r) => ({ ...r, name: r.products?.name || '', category: r.products?.category || '' }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  res.json(rows)
})

/* ---------- Stock across the whole network ----------
   This is the referral lookup: "we're out of Losartan — who has it?" */

router.get('/inventory/network', requireManager, async (req, res) => {
  const search = (req.query.q || '').trim()
  const productId = req.query.product_id ? Number(req.query.product_id) : null

  let q = db
    .from('branch_inventory')
    .select('branch_id, product_id, stock, is_available, branches(name, city, province, phone), products(name, generic_name, category, price)')
    .gt('stock', 0)
    .eq('is_available', true)
  if (productId) q = q.eq('product_id', productId)

  const { data, error } = await q
  if (error) {
    if (isMissingInventory(error)) return res.status(503).json({ error: INVENTORY_MIGRATION_HINT })
    return res.status(500).json({ error: error.message })
  }

  const term = search.toLowerCase()
  const rows = data
    .filter((r) => !term || `${r.products?.name} ${r.products?.generic_name}`.toLowerCase().includes(term))
    .map((r) => ({
      branch_id: r.branch_id,
      product_id: r.product_id,
      stock: r.stock,
      medicine: r.products?.name || '',
      generic_name: r.products?.generic_name || '',
      category: r.products?.category || '',
      price: r.products?.price ?? 0,
      branch_name: r.branches?.name || '',
      city: r.branches?.city || '',
      province: r.branches?.province || '',
      phone: r.branches?.phone || '',
    }))
    .sort((a, b) => a.medicine.localeCompare(b.medicine) || b.stock - a.stock)

  res.json(rows)
})

/* ---------- Catalog picker (manager needs it to choose a medicine) ---------- */

router.get('/catalog', requireManager, async (_req, res) => {
  const { data, error } = await db
    .from('products')
    .select('id, name, generic_name, category, price, requires_rx')
    .eq('is_active', true)
    .order('name')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

/* ---------- Start carrying a medicine at this branch ----------
   Managers act on their own branch only — the branch comes from their
   token, never the request body. A superadmin may name any branch.
   Stock is never copied from another branch; whoever adds it types in
   the quantity that physically arrived. */

router.post('/inventory', requireManager, async (req, res) => {
  const branchId = scopedBranchId(req, req.body?.branch_id ? Number(req.body.branch_id) : null)
  if (!branchId) return res.status(400).json({ error: 'branch_id is required' })

  const { product_id, product, opening_stock, low_stock_at } = req.body || {}
  const stock = Number(opening_stock) || 0
  if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) {
    return res.status(400).json({ error: 'Opening stock must be a whole number between 0 and 1,000,000' })
  }

  /* Resolve which catalog medicine this is: an existing one, or a new entry. */
  let productId = product_id ? Number(product_id) : null
  if (!productId) {
    const name = product?.name?.trim()
    if (!name) return res.status(400).json({ error: 'Pick a medicine from the list, or type a new medicine name' })

    /* Reuse a same-named catalog entry so the network stock lookup keeps matching. */
    const { data: existing } = await db.from('products').select('id').ilike('name', name).maybeSingle()
    if (existing) {
      productId = existing.id
    } else {
      const price = Number(product.price)
      if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'Enter a valid price' })
      const { data: created, error: createErr } = await db
        .from('products')
        .insert({
          name,
          generic_name: product.generic_name?.trim() || '',
          description: product.description?.trim() || '',
          category: product.category?.trim() || 'General',
          price,
          requires_rx: !!product.requires_rx,
        })
        .select('id')
        .single()
      if (createErr) return res.status(500).json({ error: createErr.message })
      productId = created.id
    }
  }

  /* Start at zero, then move the opening quantity in through adjust_stock so
     the very first delivery shows up in the stock history like any other. */
  const { data, error } = await db
    .from('branch_inventory')
    .insert({
      branch_id: branchId,
      product_id: productId,
      stock: 0,
      low_stock_at: Number.isInteger(Number(low_stock_at)) ? Number(low_stock_at) : 10,
    })
    .select('id, branch_id, product_id, stock, low_stock_at, is_available, products(name, category, price)')
    .single()
  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'This branch already carries that medicine — use Stock in to add more.' })
    }
    if (isMissingInventory(error)) return res.status(503).json({ error: INVENTORY_MIGRATION_HINT })
    return res.status(500).json({ error: error.message })
  }

  if (stock > 0) {
    const { error: moveErr } = await db.rpc('adjust_stock', {
      p_branch_id: branchId,
      p_product_id: productId,
      p_delta: stock,
      p_reason: 'stock_in',
      p_note: 'Opening stock',
      p_order_reference: '',
      p_admin_id: req.admin.id,
    })
    if (moveErr) {
      return res.status(500).json({
        error: `Medicine added, but the opening stock of ${stock} did not save (${moveErr.message}). Use Stock in to set it.`,
      })
    }
  }

  res.status(201).json({ ...data, stock })
})

/* ---------- Availability / low-stock threshold ---------- */

router.patch('/inventory/:id', requireManager, async (req, res) => {
  const updates = {}
  if (req.body?.is_available !== undefined) updates.is_available = !!req.body.is_available
  if (req.body?.low_stock_at !== undefined) {
    const n = Number(req.body.low_stock_at)
    if (!Number.isInteger(n) || n < 0) return res.status(400).json({ error: 'Low-stock alert must be a whole number' })
    updates.low_stock_at = n
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' })

  let q = db.from('branch_inventory').update(updates).eq('id', Number(req.params.id))
  if (!isSuper(req)) q = q.eq('branch_id', req.admin.branch_id)
  const { data, error } = await q.select('id, stock, low_stock_at, is_available').maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Medicine not found in your branch inventory' })
  res.json(data)
})

/* ---------- Move stock ----------
   Handlers ring up face-to-face sales, so they may only take stock DOWN.
   Anything that puts stock in is the manager's call. */

const STOCK_REASONS = ['stock_in', 'walkin_sale', 'adjustment', 'expired', 'damaged', 'returned']

router.post('/inventory/:id/adjust', async (req, res) => {
  const delta = Number(req.body?.delta)
  if (!Number.isInteger(delta) || delta === 0) {
    return res.status(400).json({ error: 'Enter a whole number of units to add or remove' })
  }
  if (Math.abs(delta) > 1_000_000) return res.status(400).json({ error: 'That quantity is too large' })

  const reason = STOCK_REASONS.includes(req.body?.reason) ? req.body.reason : 'adjustment'
  if (req.admin.role === 'handler' && delta > 0) {
    return res.status(403).json({ error: 'Only the branch manager can stock medicines in. Handlers record sales and losses.' })
  }

  /* Confirm the row belongs to the caller's branch before touching stock. */
  const { data: row, error: rowErr } = await db
    .from('branch_inventory')
    .select('id, branch_id, product_id, products(name)')
    .eq('id', Number(req.params.id))
    .maybeSingle()
  if (rowErr) {
    if (isMissingInventory(rowErr)) return res.status(503).json({ error: INVENTORY_MIGRATION_HINT })
    return res.status(500).json({ error: rowErr.message })
  }
  if (!row) return res.status(404).json({ error: 'Medicine not found in your branch inventory' })
  if (!isSuper(req) && row.branch_id !== req.admin.branch_id) {
    return res.status(403).json({ error: 'You can only change stock at your own branch' })
  }

  const { data: stockAfter, error } = await db.rpc('adjust_stock', {
    p_branch_id: row.branch_id,
    p_product_id: row.product_id,
    p_delta: delta,
    p_reason: reason,
    p_note: (req.body?.note || '').slice(0, 200),
    p_order_reference: '',
    p_admin_id: req.admin.id,
  })
  if (error) {
    if (/INSUFFICIENT_STOCK/.test(error.message)) {
      return res.status(409).json({ error: `Not enough ${row.products?.name || 'stock'} left at this branch.` })
    }
    if (isMissingInventory(error)) return res.status(503).json({ error: INVENTORY_MIGRATION_HINT })
    return res.status(500).json({ error: error.message })
  }

  res.json({ id: row.id, stock: stockAfter })
})

/* ---------- Stock history ---------- */

router.get('/stock-movements', async (req, res) => {
  const branchId = scopedBranchId(req, req.query.branch_id ? Number(req.query.branch_id) : null)
  let q = db
    .from('stock_movements')
    .select('id, delta, stock_after, reason, note, order_reference, created_at, products(name), admins(display_name)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (branchId) q = q.eq('branch_id', branchId)
  const { data, error } = await q
  if (error) {
    if (isMissingInventory(error)) return res.status(503).json({ error: INVENTORY_MIGRATION_HINT })
    return res.status(500).json({ error: error.message })
  }
  res.json(data)
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

const BRANCH_FIELDS = [
  'name', 'target_client', 'engagement', 'area', 'province', 'city',
  'address', 'phone', 'is_active', 'gcash_number', 'qr_image_url',
]

/* Copy only the columns we mean to expose, and turn the pasted Google Maps
   embed into a checked URL plus coordinates (see server/src/maps.js). */
function branchPayload(body) {
  const payload = {}
  for (const field of BRANCH_FIELDS) {
    if (body?.[field] !== undefined) payload[field] = body[field]
  }
  if (body?.map_embed !== undefined) {
    Object.assign(payload, parseMapEmbed(body.map_embed))
  }
  return payload
}

router.post('/branches', async (req, res) => {
  let payload
  try {
    payload = branchPayload(req.body)
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message })
  }
  if (!payload.name?.trim()) return res.status(400).json({ error: 'Branch name is required' })

  const { data, error } = await db.from('branches').insert(payload).select().single()
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
  let payload
  try {
    payload = branchPayload(req.body)
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message })
  }
  if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'Nothing to update' })

  const { data, error } = await db.from('branches').update(payload).eq('id', Number(req.params.id)).select().single()
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

const STAFF_ROLES = ['manager', 'handler']

router.post('/admins', async (req, res) => {
  const { username, password, display_name, role, branch_id } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' })
  if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

  const isSuperAccount = role === 'super'
  if (!isSuperAccount && !STAFF_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Role must be manager, handler, or super' })
  }
  if (!isSuperAccount && !branch_id) {
    return res.status(400).json({ error: 'Managers and handlers must be assigned to a branch' })
  }

  const { data, error } = await db
    .from('admins')
    .insert({
      username: username.toLowerCase().trim(),
      password_hash: bcrypt.hashSync(password, 10),
      display_name: display_name || username,
      role: isSuperAccount ? 'super' : role,
      branch_id: isSuperAccount ? null : branch_id,
    })
    .select('id, username, display_name, role, branch_id')
    .single()
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'That username is already taken' })
    return res.status(500).json({ error: error.message })
  }
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
