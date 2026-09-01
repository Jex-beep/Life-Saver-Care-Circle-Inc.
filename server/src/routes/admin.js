import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db.js'
import { signAdminToken, requireAdmin, requireSuper, requireManager, isSuper, scopedBranchId } from '../auth.js'
import { localDateStr } from '../helpers.js'
import { parseMapEmbed } from '../maps.js'

const router = Router()

const INVENTORY_MIGRATION_HINT =
  'Medicine stock is not set up yet — run supabase/migration-004-inventory-roles-maps.sql against your RDS database.'

/* migration 004 adds branch_inventory, stock_movements, and adjust_stock() */
function isMissingInventory(err) {
  return /branch_inventory|stock_movements|adjust_stock/.test(err?.message || '')
}

/* Build a dynamic INSERT from a plain object of column:value pairs */
function buildInsert(table, obj, returning = '*') {
  const keys = Object.keys(obj)
  const cols = keys.map((k) => `"${k}"`).join(', ')
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
  const values = keys.map((k) => obj[k])
  return { text: `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING ${returning}`, values }
}

/* Build a dynamic UPDATE ... WHERE id = $n from a plain object */
function buildUpdate(table, id, obj, returning = '*') {
  const keys = Object.keys(obj)
  const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ')
  const values = keys.map((k) => obj[k])
  values.push(id)
  return { text: `UPDATE ${table} SET ${setClause} WHERE id = $${values.length} RETURNING ${returning}`, values }
}

/* ---------- Login ---------- */

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' })

  try {
    const { rows } = await db.query(
      `SELECT a.*, b.name AS branch_name
       FROM admins a
       LEFT JOIN branches b ON b.id = a.branch_id
       WHERE a.username = $1 AND a.is_active = true
       LIMIT 1`,
      [username.toLowerCase().trim()]
    )
    const admin = rows[0] || null
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
        branch_name: admin.branch_name || null,
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.use(requireAdmin)

/* ---------- Dashboard summary ---------- */

router.get('/summary', async (req, res) => {
  const branchId = scopedBranchId(req, req.query.branch_id ? Number(req.query.branch_id) : null)
  const today = localDateStr()

  try {
    const bookingsParams = [today]
    let bookingsSql = `SELECT COUNT(*) FROM bookings WHERE booking_date = $1 AND status != 'cancelled'`
    if (branchId) {
      bookingsParams.push(branchId)
      bookingsSql += ` AND branch_id = $${bookingsParams.length}`
    }

    const ordersParams = [['placed', 'preparing']]
    let ordersSql = `SELECT COUNT(*) FROM orders WHERE status = ANY($1)`
    if (branchId) {
      ordersParams.push(branchId)
      ordersSql += ` AND branch_id = $${ordersParams.length}`
    }

    const verifyParams = []
    let verifySql = `SELECT COUNT(*) FROM orders WHERE payment_status = 'for_verification'`
    if (branchId) {
      verifyParams.push(branchId)
      verifySql += ` AND branch_id = $${verifyParams.length}`
    }

    const [bookingsResult, ordersResult, verifyResult] = await Promise.all([
      db.query(bookingsSql, bookingsParams),
      db.query(ordersSql, ordersParams),
      db.query(verifySql, verifyParams),
    ])

    res.json({
      todayBookings: Number(bookingsResult.rows[0].count) || 0,
      openOrders: Number(ordersResult.rows[0].count) || 0,
      paymentsToVerify: Number(verifyResult.rows[0].count) || 0,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ---------- Bookings ---------- */

router.get('/bookings', async (req, res) => {
  const branchId = scopedBranchId(req, req.query.branch_id ? Number(req.query.branch_id) : null)

  try {
    const conditions = []
    const params = []
    if (branchId) {
      params.push(branchId)
      conditions.push(`b.branch_id = $${params.length}`)
    }
    if (req.query.date) {
      params.push(req.query.date)
      conditions.push(`b.booking_date = $${params.length}`)
    }
    if (req.query.status) {
      params.push(req.query.status)
      conditions.push(`b.status = $${params.length}`)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await db.query(
      `SELECT b.*, br.name AS branch_name, s.name AS service_name
       FROM bookings b
       LEFT JOIN branches br ON br.id = b.branch_id
       LEFT JOIN services s ON s.id = b.service_id
       ${where}
       ORDER BY b.booking_date DESC, b.booking_time ASC
       LIMIT 200`,
      params
    )
    const data = rows.map((r) => ({
      ...r,
      branches: { name: r.branch_name },
      services: { name: r.service_name },
    }))
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/bookings/:id', async (req, res) => {
  const allowed = ['confirmed', 'completed', 'cancelled', 'no_show']
  if (!allowed.includes(req.body?.status)) return res.status(400).json({ error: 'Invalid status' })

  try {
    const params = [req.body.status, Number(req.params.id)]
    let sql = `UPDATE bookings SET status = $1 WHERE id = $2`
    if (req.admin.role !== 'super') {
      params.push(req.admin.branch_id)
      sql += ` AND branch_id = $${params.length}`
    }
    sql += ` RETURNING id, status`
    const { rows } = await db.query(sql, params)
    if (rows.length === 0) return res.status(404).json({ error: 'Booking not found for your branch' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ---------- Orders ---------- */

router.get('/orders', async (req, res) => {
  const branchId = scopedBranchId(req, req.query.branch_id ? Number(req.query.branch_id) : null)

  try {
    const conditions = []
    const params = []
    if (branchId) {
      params.push(branchId)
      conditions.push(`o.branch_id = $${params.length}`)
    }
    if (req.query.status) {
      params.push(req.query.status)
      conditions.push(`o.status = $${params.length}`)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await db.query(
      `SELECT o.*, br.name AS branch_name
       FROM orders o
       LEFT JOIN branches br ON br.id = o.branch_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT 200`,
      params
    )
    const data = rows.map((r) => ({ ...r, branches: { name: r.branch_name } }))
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
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

  try {
    /* Cancelling puts the medicines back on the shelf. Read the order first so
       we know what to return, and only return it if it wasn't already cancelled. */
    let previous = null
    if (updates.status === 'cancelled') {
      const { rows } = await db.query(
        `SELECT id, branch_id, status, items, reference FROM orders WHERE id = $1 LIMIT 1`,
        [Number(req.params.id)]
      )
      previous = rows[0] || null
    }

    const params = []
    const setClauses = []
    for (const [key, value] of Object.entries(updates)) {
      params.push(value)
      setClauses.push(`"${key}" = $${params.length}`)
    }
    params.push(Number(req.params.id))
    let sql = `UPDATE orders SET ${setClauses.join(', ')} WHERE id = $${params.length}`
    if (!isSuper(req)) {
      params.push(req.admin.branch_id)
      sql += ` AND branch_id = $${params.length}`
    }
    sql += ` RETURNING id, status, payment_status`

    const { rows } = await db.query(sql, params)
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found for your branch' })
    const data = rows[0]

    if (previous && previous.status !== 'cancelled' && Array.isArray(previous.items)) {
      for (const item of previous.items) {
        await db.query(
          `SELECT adjust_stock(
             p_branch_id := $1, p_product_id := $2, p_delta := $3,
             p_reason := $4, p_note := $5, p_order_reference := $6, p_admin_id := $7
           )`,
          [previous.branch_id, item.product_id, Number(item.qty) || 0, 'returned', 'Order cancelled', previous.reference || '', req.admin.id]
        )
      }
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ---------- Branch schedule ---------- */

router.get('/schedule', async (req, res) => {
  const branchId = scopedBranchId(req, req.query.branch_id ? Number(req.query.branch_id) : null)
  if (!branchId) return res.status(400).json({ error: 'branch_id is required' })
  try {
    const { rows } = await db.query(`SELECT * FROM branch_schedules WHERE branch_id = $1 ORDER BY weekday`, [branchId])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/schedule/:weekday', async (req, res) => {
  const branchId = scopedBranchId(req, req.body?.branch_id ? Number(req.body.branch_id) : null)
  if (!branchId) return res.status(400).json({ error: 'branch_id is required' })
  const weekday = Number(req.params.weekday)
  const { open_time, close_time, slot_minutes, capacity, is_open } = req.body || {}

  try {
    const { rows } = await db.query(
      `INSERT INTO branch_schedules (branch_id, weekday, open_time, close_time, slot_minutes, capacity, is_open)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (branch_id, weekday)
       DO UPDATE SET open_time = EXCLUDED.open_time, close_time = EXCLUDED.close_time,
                      slot_minutes = EXCLUDED.slot_minutes, capacity = EXCLUDED.capacity, is_open = EXCLUDED.is_open
       RETURNING *`,
      [branchId, weekday, open_time, close_time, slot_minutes, capacity, is_open]
    )
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ---------- Branch payment settings (GCash / QRPh) ---------- */

router.get('/branch-settings', async (req, res) => {
  const branchId = scopedBranchId(req, req.query.branch_id ? Number(req.query.branch_id) : null)
  if (!branchId) return res.status(400).json({ error: 'branch_id is required' })
  try {
    const { rows } = await db.query(
      `SELECT id, name, address, phone, gcash_number, qr_image_url FROM branches WHERE id = $1 LIMIT 1`,
      [branchId]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Branch not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
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

  try {
    if (Object.keys(updates).length === 0) {
      const { rows } = await db.query(`SELECT * FROM branches WHERE id = $1 LIMIT 1`, [branchId])
      return res.json(rows[0])
    }
    const { text, values } = buildUpdate('branches', branchId, updates)
    const { rows } = await db.query(text, values)
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ---------- Capacity blocks (per-date booking limits) ---------- */

router.get('/capacity-blocks', async (req, res) => {
  const branchId = scopedBranchId(req, req.query.branch_id ? Number(req.query.branch_id) : null)
  if (!branchId) return res.status(400).json({ error: 'branch_id is required' })
  const from = req.query.from || new Date().toISOString().slice(0, 10)
  const to = req.query.to || null

  try {
    const params = [branchId, from]
    let sql = `SELECT * FROM capacity_blocks WHERE branch_id = $1 AND block_date >= $2`
    if (to) {
      params.push(to)
      sql += ` AND block_date <= $${params.length}`
    }
    sql += ` ORDER BY block_date, start_time`

    const { rows: blocks } = await db.query(sql, params)

    const dates = [...new Set(blocks.map((b) => b.block_date))]
    let bookings = []
    if (dates.length > 0) {
      const { rows } = await db.query(
        `SELECT booking_date, booking_time FROM bookings
         WHERE branch_id = $1 AND booking_date = ANY($2) AND status != 'cancelled'`,
        [branchId, dates]
      )
      bookings = rows
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
  } catch (err) {
    if (/capacity_blocks/.test(err.message)) {
      return res.status(503).json({
        error: 'Capacity blocks are not set up yet — run supabase/migration-002-capacity-blocks.sql against your RDS database.',
      })
    }
    res.status(500).json({ error: err.message })
  }
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

  try {
    const { rows } = await db.query(
      `INSERT INTO capacity_blocks (branch_id, block_date, start_time, end_time, max_patients, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [branchId, block_date, start_time, end_time, max, note || '']
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (/capacity_blocks/.test(err.message)) {
      return res.status(503).json({
        error: 'Capacity blocks are not set up yet — run supabase/migration-002-capacity-blocks.sql against your RDS database.',
      })
    }
    res.status(500).json({ error: err.message })
  }
})

router.delete('/capacity-blocks/:id', async (req, res) => {
  try {
    const params = [Number(req.params.id)]
    let sql = `DELETE FROM capacity_blocks WHERE id = $1`
    if (req.admin.role !== 'super') {
      params.push(req.admin.branch_id)
      sql += ` AND branch_id = $${params.length}`
    }
    sql += ` RETURNING id`
    const { rows } = await db.query(sql, params)
    if (rows.length === 0) return res.status(404).json({ error: 'Block not found for your branch' })
    res.json({ deleted: rows[0].id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
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

  try {
    const { rows } = await db.query(
      `SELECT bi.id, bi.branch_id, bi.product_id, bi.stock, bi.low_stock_at, bi.is_available, bi.updated_at,
              p.name AS product_name, p.generic_name, p.category, p.price, p.requires_rx, p.is_active
       FROM branch_inventory bi
       LEFT JOIN products p ON p.id = bi.product_id
       WHERE bi.branch_id = $1`,
      [branchId]
    )
    const data = rows
      .map((r) => ({
        ...r,
        products: {
          name: r.product_name,
          generic_name: r.generic_name,
          category: r.category,
          price: r.price,
          requires_rx: r.requires_rx,
          is_active: r.is_active,
        },
        name: r.product_name || '',
      }))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
    res.json(data)
  } catch (err) {
    if (isMissingInventory(err)) return res.status(503).json({ error: INVENTORY_MIGRATION_HINT })
    res.status(500).json({ error: err.message })
  }
})

/* ---------- Stock across the whole network ----------
   This is the referral lookup: "we're out of Losartan — who has it?" */

router.get('/inventory/network', requireManager, async (req, res) => {
  const search = (req.query.q || '').trim()
  const productId = req.query.product_id ? Number(req.query.product_id) : null

  try {
    const params = []
    let sql = `
      SELECT bi.branch_id, bi.product_id, bi.stock,
             br.name AS branch_name, br.city, br.province, br.phone,
             p.name AS product_name, p.generic_name, p.category, p.price
      FROM branch_inventory bi
      LEFT JOIN branches br ON br.id = bi.branch_id
      LEFT JOIN products p ON p.id = bi.product_id
      WHERE bi.stock > 0 AND bi.is_available = true`
    if (productId) {
      params.push(productId)
      sql += ` AND bi.product_id = $${params.length}`
    }

    const { rows } = await db.query(sql, params)

    const term = search.toLowerCase()
    const data = rows
      .filter((r) => !term || `${r.product_name} ${r.generic_name}`.toLowerCase().includes(term))
      .map((r) => ({
        branch_id: r.branch_id,
        product_id: r.product_id,
        stock: r.stock,
        medicine: r.product_name || '',
        generic_name: r.generic_name || '',
        category: r.category || '',
        price: r.price ?? 0,
        branch_name: r.branch_name || '',
        city: r.city || '',
        province: r.province || '',
        phone: r.phone || '',
      }))
      .sort((a, b) => a.medicine.localeCompare(b.medicine) || b.stock - a.stock)

    res.json(data)
  } catch (err) {
    if (isMissingInventory(err)) return res.status(503).json({ error: INVENTORY_MIGRATION_HINT })
    res.status(500).json({ error: err.message })
  }
})

/* ---------- Catalog picker (manager needs it to choose a medicine) ---------- */

router.get('/catalog', requireManager, async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, generic_name, category, price, requires_rx
       FROM products
       WHERE is_active = true
       ORDER BY name`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
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

  try {
    /* Resolve which catalog medicine this is: an existing one, or a new entry. */
    let productId = product_id ? Number(product_id) : null
    if (!productId) {
      const name = product?.name?.trim()
      if (!name) return res.status(400).json({ error: 'Pick a medicine from the list, or type a new medicine name' })

      /* Reuse a same-named catalog entry so the network stock lookup keeps matching. */
      const { rows: existingRows } = await db.query(`SELECT id FROM products WHERE name ILIKE $1 LIMIT 1`, [name])
      if (existingRows.length > 0) {
        productId = existingRows[0].id
      } else {
        const price = Number(product.price)
        if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'Enter a valid price' })
        const { rows: created } = await db.query(
          `INSERT INTO products (name, generic_name, description, category, price, requires_rx)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            name,
            product.generic_name?.trim() || '',
            product.description?.trim() || '',
            product.category?.trim() || 'General',
            price,
            !!product.requires_rx,
          ]
        )
        productId = created[0].id
      }
    }

    /* Start at zero, then move the opening quantity in through adjust_stock so
       the very first delivery shows up in the stock history like any other. */
    let data
    try {
      const { rows } = await db.query(
        `INSERT INTO branch_inventory (branch_id, product_id, stock, low_stock_at)
         VALUES ($1, $2, 0, $3)
         RETURNING id, branch_id, product_id, stock, low_stock_at, is_available`,
        [branchId, productId, Number.isInteger(Number(low_stock_at)) ? Number(low_stock_at) : 10]
      )
      data = rows[0]
    } catch (insertErr) {
      if (insertErr.code === '23505') {
        return res.status(409).json({ error: 'This branch already carries that medicine — use Stock in to add more.' })
      }
      throw insertErr
    }

    const { rows: prodRows } = await db.query(`SELECT name, category, price FROM products WHERE id = $1 LIMIT 1`, [productId])
    data.products = prodRows[0] || {}

    if (stock > 0) {
      try {
        await db.query(
          `SELECT adjust_stock(
             p_branch_id := $1, p_product_id := $2, p_delta := $3,
             p_reason := $4, p_note := $5, p_order_reference := $6, p_admin_id := $7
           )`,
          [branchId, productId, stock, 'stock_in', 'Opening stock', '', req.admin.id]
        )
      } catch (moveErr) {
        return res.status(500).json({
          error: `Medicine added, but the opening stock of ${stock} did not save (${moveErr.message}). Use Stock in to set it.`,
        })
      }
    }

    res.status(201).json({ ...data, stock })
  } catch (err) {
    if (isMissingInventory(err)) return res.status(503).json({ error: INVENTORY_MIGRATION_HINT })
    res.status(500).json({ error: err.message })
  }
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

  try {
    const params = []
    const setClauses = []
    for (const [key, value] of Object.entries(updates)) {
      params.push(value)
      setClauses.push(`"${key}" = $${params.length}`)
    }
    params.push(Number(req.params.id))
    let sql = `UPDATE branch_inventory SET ${setClauses.join(', ')} WHERE id = $${params.length}`
    if (!isSuper(req)) {
      params.push(req.admin.branch_id)
      sql += ` AND branch_id = $${params.length}`
    }
    sql += ` RETURNING id, stock, low_stock_at, is_available`

    const { rows } = await db.query(sql, params)
    if (rows.length === 0) return res.status(404).json({ error: 'Medicine not found in your branch inventory' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
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

  try {
    /* Confirm the row belongs to the caller's branch before touching stock. */
    const { rows } = await db.query(
      `SELECT bi.id, bi.branch_id, bi.product_id, p.name AS product_name
       FROM branch_inventory bi
       LEFT JOIN products p ON p.id = bi.product_id
       WHERE bi.id = $1
       LIMIT 1`,
      [Number(req.params.id)]
    )
    const row = rows[0] || null
    if (!row) return res.status(404).json({ error: 'Medicine not found in your branch inventory' })
    if (!isSuper(req) && row.branch_id !== req.admin.branch_id) {
      return res.status(403).json({ error: 'You can only change stock at your own branch' })
    }

    let stockAfter
    try {
      const result = await db.query(
        `SELECT adjust_stock(
           p_branch_id := $1, p_product_id := $2, p_delta := $3,
           p_reason := $4, p_note := $5, p_order_reference := $6, p_admin_id := $7
         ) AS stock_after`,
        [row.branch_id, row.product_id, delta, reason, (req.body?.note || '').slice(0, 200), '', req.admin.id]
      )
      stockAfter = result.rows[0].stock_after
    } catch (error) {
      if (/INSUFFICIENT_STOCK/.test(error.message)) {
        return res.status(409).json({ error: `Not enough ${row.product_name || 'stock'} left at this branch.` })
      }
      if (isMissingInventory(error)) return res.status(503).json({ error: INVENTORY_MIGRATION_HINT })
      return res.status(500).json({ error: error.message })
    }

    res.json({ id: row.id, stock: stockAfter })
  } catch (err) {
    if (isMissingInventory(err)) return res.status(503).json({ error: INVENTORY_MIGRATION_HINT })
    res.status(500).json({ error: err.message })
  }
})

/* ---------- Stock history ---------- */

router.get('/stock-movements', async (req, res) => {
  const branchId = scopedBranchId(req, req.query.branch_id ? Number(req.query.branch_id) : null)

  try {
    const params = []
    let sql = `
      SELECT sm.id, sm.delta, sm.stock_after, sm.reason, sm.note, sm.order_reference, sm.created_at,
             p.name AS product_name, a.display_name AS admin_display_name
      FROM stock_movements sm
      LEFT JOIN products p ON p.id = sm.product_id
      LEFT JOIN admins a ON a.id = sm.admin_id
    `
    if (branchId) {
      params.push(branchId)
      sql += ` WHERE sm.branch_id = $${params.length}`
    }
    sql += ` ORDER BY sm.created_at DESC LIMIT 100`

    const { rows } = await db.query(sql, params)
    const data = rows.map((r) => ({
      ...r,
      products: { name: r.product_name },
      admins: { display_name: r.admin_display_name },
    }))
    res.json(data)
  } catch (err) {
    if (isMissingInventory(err)) return res.status(503).json({ error: INVENTORY_MIGRATION_HINT })
    res.status(500).json({ error: err.message })
  }
})

/* ============================================================
   Corporate (super admin) only below
   ============================================================ */

router.use(requireSuper)

/* ---------- Announcements CRUD (superadmin) ---------- */

const ANN_MIGRATION_HINT =
  'Announcements are not set up yet — run supabase/migration-003-announcements.sql against your RDS database.'

router.get('/announcements', async (_req, res) => {
  try {
    const { rows } = await db.query(`SELECT * FROM announcements ORDER BY is_pinned DESC, published_at DESC`)
    res.json(rows)
  } catch (err) {
    if (/announcements/.test(err.message)) return res.status(503).json({ error: ANN_MIGRATION_HINT })
    res.status(500).json({ error: err.message })
  }
})

router.post('/announcements', async (req, res) => {
  const { title, body, category, is_published, is_pinned } = req.body || {}
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' })
  const cat = ['news', 'hiring', 'advisory'].includes(category) ? category : 'news'

  try {
    if (is_pinned) {
      await db.query(`UPDATE announcements SET is_pinned = false WHERE is_pinned = true`)
    }

    const { rows } = await db.query(
      `INSERT INTO announcements (title, body, category, is_published, is_pinned)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title.trim(), body || '', cat, is_published !== false, !!is_pinned]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (/announcements/.test(err.message)) return res.status(503).json({ error: ANN_MIGRATION_HINT })
    res.status(500).json({ error: err.message })
  }
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

  try {
    if (updates.is_pinned === true) {
      await db.query(`UPDATE announcements SET is_pinned = false WHERE is_pinned = true`)
    }

    const { text, values } = buildUpdate('announcements', Number(req.params.id), updates)
    const { rows } = await db.query(text, values)
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/announcements/:id', async (req, res) => {
  try {
    const { rows } = await db.query(`DELETE FROM announcements WHERE id = $1 RETURNING id`, [Number(req.params.id)])
    if (rows.length === 0) return res.status(404).json({ error: 'Announcement not found' })
    res.json({ deleted: rows[0].id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ---------- Branches CRUD ---------- */

router.get('/branches', async (_req, res) => {
  try {
    const { rows } = await db.query(`SELECT * FROM branches ORDER BY area, name`)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
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

  try {
    const { text, values } = buildInsert('branches', payload)
    const { rows } = await db.query(text, values)
    const data = rows[0]

    // give the new branch a default Mon-Sat schedule
    const scheduleRows = [0, 1, 2, 3, 4, 5, 6].map((weekday) => [data.id, weekday, weekday !== 0])
    const valuesSql = scheduleRows.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ')
    const flatParams = scheduleRows.flat()
    await db.query(`INSERT INTO branch_schedules (branch_id, weekday, is_open) VALUES ${valuesSql}`, flatParams)

    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/branches/:id', async (req, res) => {
  let payload
  try {
    payload = branchPayload(req.body)
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message })
  }
  if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'Nothing to update' })

  try {
    const { text, values } = buildUpdate('branches', Number(req.params.id), payload)
    const { rows } = await db.query(text, values)
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ---------- Services CRUD ---------- */

router.get('/services', async (_req, res) => {
  try {
    const { rows } = await db.query(`SELECT * FROM services ORDER BY sort_order`)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/services', async (req, res) => {
  try {
    const { text, values } = buildInsert('services', req.body || {})
    const { rows } = await db.query(text, values)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/services/:id', async (req, res) => {
  try {
    const { text, values } = buildUpdate('services', Number(req.params.id), req.body || {})
    const { rows } = await db.query(text, values)
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ---------- Products CRUD ---------- */

router.get('/products', async (_req, res) => {
  try {
    const { rows } = await db.query(`SELECT * FROM products ORDER BY category, name`)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/products', async (req, res) => {
  try {
    const { text, values } = buildInsert('products', req.body || {})
    const { rows } = await db.query(text, values)
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/products/:id', async (req, res) => {
  try {
    const { text, values } = buildUpdate('products', Number(req.params.id), req.body || {})
    const { rows } = await db.query(text, values)
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ---------- Admin accounts CRUD ---------- */

router.get('/admins', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT a.id, a.username, a.display_name, a.role, a.branch_id, a.is_active, b.name AS branch_name
       FROM admins a
       LEFT JOIN branches b ON b.id = a.branch_id
       ORDER BY a.role, a.username`
    )
    const data = rows.map((r) => ({ ...r, branches: { name: r.branch_name } }))
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
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

  try {
    const { rows } = await db.query(
      `INSERT INTO admins (username, password_hash, display_name, role, branch_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, display_name, role, branch_id`,
      [
        username.toLowerCase().trim(),
        bcrypt.hashSync(password, 10),
        display_name || username,
        isSuperAccount ? 'super' : role,
        isSuperAccount ? null : branch_id,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That username is already taken' })
    res.status(500).json({ error: err.message })
  }
})

router.patch('/admins/:id', async (req, res) => {
  const updates = {}
  if (req.body?.password) updates.password_hash = bcrypt.hashSync(req.body.password, 10)
  if (req.body?.display_name !== undefined) updates.display_name = req.body.display_name
  if (req.body?.is_active !== undefined) updates.is_active = req.body.is_active
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' })

  try {
    const { text, values } = buildUpdate('admins', Number(req.params.id), updates, 'id, username, is_active')
    const { rows } = await db.query(text, values)
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router