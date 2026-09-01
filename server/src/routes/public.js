import { Router } from 'express'
import { db } from '../db.js'
import { makeReference, buildSlots, localDateStr, timeToMinutes, minutesToTime } from '../helpers.js'

const router = Router()

/* capacity_blocks is added by migration 002 — treat a missing table as "no blocks" */
async function getBlocks(branchId, fromDate, toDate) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM capacity_blocks
       WHERE branch_id = $1 AND block_date >= $2 AND block_date <= $3
       ORDER BY start_time`,
      [branchId, fromDate, toDate]
    )
    return rows
  } catch (err) {
    return []
  }
}

const pad2 = (n) => String(n).padStart(2, '0')

function inBlock(block, timeStr) {
  const t = timeToMinutes(timeStr)
  return t >= timeToMinutes(block.start_time) && t < timeToMinutes(block.end_time)
}

/* ---------- Branches ---------- */

router.get('/branches', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, target_client, area, province, city, address, phone, map_embed_src, latitude, longitude
       FROM branches
       WHERE is_active = true
       ORDER BY area, province, city`
    )
    return res.json(rows)
  } catch (err) {
    /* map columns arrive with migration 004 — fall back so the finder still works */
    if (/map_embed_src|latitude|longitude/.test(err.message)) {
      try {
        const { rows: legacy } = await db.query(
          `SELECT id, name, target_client, area, province, city, address, phone
           FROM branches
           WHERE is_active = true
           ORDER BY area`
        )
        return res.json(legacy)
      } catch (err2) {
        return res.status(500).json({ error: err2.message })
      }
    }
    return res.status(500).json({ error: err.message })
  }
})

/* ---------- Services ---------- */

router.get('/services', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, description, duration_min
       FROM services
       WHERE is_active = true
       ORDER BY sort_order`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ---------- Month availability overview (for the booking calendar) ---------- */

router.get('/branches/:id/availability', async (req, res) => {
  const branchId = Number(req.params.id)
  const year = Number(req.query.year)
  const month = Number(req.query.month) // 1-12
  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).json({ error: 'year and month (1-12) are required' })
  }

  const lastDay = new Date(year, month, 0).getDate()
  const first = `${year}-${pad2(month)}-01`
  const last = `${year}-${pad2(month)}-${pad2(lastDay)}`

  try {
    const [schedulesResult, blocks, bookingsResult] = await Promise.all([
      db.query(`SELECT * FROM branch_schedules WHERE branch_id = $1`, [branchId]),
      getBlocks(branchId, first, last),
      db.query(
        `SELECT booking_date FROM bookings
         WHERE branch_id = $1 AND booking_date >= $2 AND booking_date <= $3 AND status != 'cancelled'`,
        [branchId, first, last]
      ),
    ])
    const schedules = schedulesResult.rows
    const bookings = bookingsResult.rows

    const bookedByDate = {}
    for (const b of bookings) bookedByDate[b.booking_date] = (bookedByDate[b.booking_date] || 0) + 1

    const today = localDateStr()
    const days = {}
    for (let d = 1; d <= lastDay; d++) {
      const date = `${year}-${pad2(month)}-${pad2(d)}`
      const weekday = new Date(year, month - 1, d).getDay()
      const sched = schedules.find((s) => s.weekday === weekday)
      const dayBlocks = blocks.filter((b) => b.block_date === date)
      const booked = bookedByDate[date] || 0

      let capacity = 0
      if (dayBlocks.length > 0) {
        capacity = dayBlocks.reduce((sum, b) => sum + b.max_patients, 0)
      } else if (sched && sched.is_open) {
        capacity = buildSlots(sched).length * sched.capacity
      }

      const remaining = Math.max(0, capacity - booked)
      let status
      if (date < today) status = 'past'
      else if (capacity === 0) status = 'closed'
      else if (remaining === 0) status = 'full'
      else if (remaining <= Math.max(1, Math.ceil(capacity * 0.2))) status = 'limited'
      else status = 'available'

      days[date] = { status, capacity, booked, remaining }
    }

    res.json({ days })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ---------- Available slots for a branch on a date ---------- */

router.get('/branches/:id/slots', async (req, res) => {
  const branchId = Number(req.params.id)
  const date = req.query.date // YYYY-MM-DD
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' })
  }
  const weekday = new Date(`${date}T00:00:00`).getDay()

  try {
    const [scheduleResult, dayBlocks, bookedResult] = await Promise.all([
      db.query(
        `SELECT * FROM branch_schedules WHERE branch_id = $1 AND weekday = $2 LIMIT 1`,
        [branchId, weekday]
      ),
      getBlocks(branchId, date, date),
      db.query(
        `SELECT booking_time FROM bookings
         WHERE branch_id = $1 AND booking_date = $2 AND status != 'cancelled'`,
        [branchId, date]
      ),
    ])
    const schedule = scheduleResult.rows[0] || null
    const booked = bookedResult.rows

    const hasBlocks = dayBlocks.length > 0
    const scheduleOpen = schedule && schedule.is_open
    const blocksOpen = dayBlocks.some((b) => b.max_patients > 0)
    if ((hasBlocks && !blocksOpen) || (!hasBlocks && !scheduleOpen)) {
      return res.json({ open: false, slots: [], sessions: [] })
    }

    const counts = {}
    for (const b of booked) counts[b.booking_time.slice(0, 5)] = (counts[b.booking_time.slice(0, 5)] || 0) + 1

    /* per-session booked totals */
    const sessions = dayBlocks.map((b) => {
      const bookedInBlock = booked.filter((x) => inBlock(b, x.booking_time)).length
      return {
        id: b.id,
        start_time: b.start_time.slice(0, 5),
        end_time: b.end_time.slice(0, 5),
        max_patients: b.max_patients,
        booked: bookedInBlock,
        remaining: Math.max(0, b.max_patients - bookedInBlock),
        note: b.note || '',
      }
    })

    const slotMinutes = schedule?.slot_minutes || 30
    const perSlotCap = scheduleOpen ? schedule.capacity : 999 // block limit governs on block-opened days

    /* Build slot times: from block windows when blocks exist, else the weekly schedule */
    let slotTimes
    if (hasBlocks) {
      slotTimes = []
      for (const b of dayBlocks) {
        if (b.max_patients === 0) continue
        const open = timeToMinutes(b.start_time)
        const close = timeToMinutes(b.end_time)
        for (let t = open; t + slotMinutes <= close; t += slotMinutes) slotTimes.push(minutesToTime(t))
      }
      slotTimes = [...new Set(slotTimes)].sort()
    } else {
      slotTimes = buildSlots(schedule)
    }

    const now = new Date()
    const isToday = date === localDateStr(now)
    const nowMinutes = now.getHours() * 60 + now.getMinutes()

    const slots = slotTimes.map((time) => {
      const [h, m] = time.split(':').map(Number)
      const past = isToday && h * 60 + m <= nowMinutes
      let available = !past && (counts[time] || 0) < perSlotCap
      if (available && hasBlocks) {
        const session = sessions.find((s) => inBlock({ start_time: s.start_time, end_time: s.end_time }, time))
        available = !!session && session.remaining > 0
      }
      return { time, available }
    })

    res.json({ open: true, slots, sessions })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ---------- Create booking (instant confirmation) ---------- */

router.post('/bookings', async (req, res) => {
  const { branch_id, service_id, booking_date, booking_time, patient_name, phone, email, philhealth_no, notes } =
    req.body || {}
  if (!branch_id || !service_id || !booking_date || !booking_time || !patient_name || !phone) {
    return res.status(400).json({ error: 'Missing required booking details' })
  }

  const weekday = new Date(`${booking_date}T00:00:00`).getDay()

  try {
    // Re-check the slot is still free (schedule + capacity blocks)
    const [scheduleResult, dayBlocks, dayBookingsResult] = await Promise.all([
      db.query(
        `SELECT capacity, is_open FROM branch_schedules WHERE branch_id = $1 AND weekday = $2 LIMIT 1`,
        [branch_id, weekday]
      ),
      getBlocks(branch_id, booking_date, booking_date),
      db.query(
        `SELECT booking_time FROM bookings WHERE branch_id = $1 AND booking_date = $2 AND status != 'cancelled'`,
        [branch_id, booking_date]
      ),
    ])
    const schedule = scheduleResult.rows[0] || null
    const dayBookings = dayBookingsResult.rows

    const hasBlocks = dayBlocks.length > 0
    const scheduleOpen = schedule && schedule.is_open
    if (!hasBlocks && !scheduleOpen) {
      return res.status(409).json({ error: 'Branch is closed on that date' })
    }

    if (hasBlocks) {
      const block = dayBlocks.find((b) => b.max_patients > 0 && inBlock(b, `${booking_time}:00`))
      if (!block) {
        return res.status(409).json({ error: 'That time is outside the clinic sessions for this date' })
      }
      const bookedInBlock = dayBookings.filter((x) => inBlock(block, x.booking_time)).length
      if (bookedInBlock >= block.max_patients) {
        return res.status(409).json({ error: 'Sorry, that session just filled up. Please pick another time.' })
      }
    }

    const perSlotCap = scheduleOpen ? schedule.capacity : 999
    const sameSlot = dayBookings.filter((x) => x.booking_time.slice(0, 5) === booking_time).length
    if (sameSlot >= perSlotCap) {
      return res.status(409).json({ error: 'Sorry, that slot was just taken. Please pick another time.' })
    }

    const reference = makeReference('LS-BK')
    const { rows } = await db.query(
      `INSERT INTO bookings
        (reference, branch_id, service_id, booking_date, booking_time, patient_name, phone, email, philhealth_no, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'confirmed')
       RETURNING reference, booking_date, booking_time, status`,
      [reference, branch_id, service_id, booking_date, booking_time, patient_name, phone, email || '', philhealth_no || '', notes || '']
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ---------- Track booking or order by reference ---------- */

router.get('/track/:reference', async (req, res) => {
  const ref = req.params.reference.trim().toUpperCase()

  try {
    if (ref.startsWith('LS-BK')) {
      const { rows } = await db.query(
        `SELECT b.reference, b.booking_date, b.booking_time, b.patient_name, b.status, b.created_at,
                br.name AS branch_name, br.city AS branch_city, br.phone AS branch_phone,
                s.name AS service_name
         FROM bookings b
         LEFT JOIN branches br ON br.id = b.branch_id
         LEFT JOIN services s ON s.id = b.service_id
         WHERE b.reference = $1
         LIMIT 1`,
        [ref]
      )
      if (rows.length === 0) return res.status(404).json({ error: 'No booking found with that reference number' })
      const row = rows[0]
      return res.json({
        type: 'booking',
        reference: row.reference,
        booking_date: row.booking_date,
        booking_time: row.booking_time,
        patient_name: row.patient_name,
        status: row.status,
        created_at: row.created_at,
        branches: { name: row.branch_name, city: row.branch_city, phone: row.branch_phone },
        services: { name: row.service_name },
      })
    }

    if (ref.startsWith('LS-OR')) {
      const { rows } = await db.query(
        `SELECT o.reference, o.customer_name, o.items, o.total, o.payment_method, o.payment_status, o.status, o.created_at,
                br.name AS branch_name, br.city AS branch_city, br.phone AS branch_phone
         FROM orders o
         LEFT JOIN branches br ON br.id = o.branch_id
         WHERE o.reference = $1
         LIMIT 1`,
        [ref]
      )
      if (rows.length === 0) return res.status(404).json({ error: 'No order found with that reference number' })
      const row = rows[0]
      return res.json({
        type: 'order',
        reference: row.reference,
        customer_name: row.customer_name,
        items: row.items,
        total: row.total,
        payment_method: row.payment_method,
        payment_status: row.payment_status,
        status: row.status,
        created_at: row.created_at,
        branches: { name: row.branch_name, city: row.branch_city, phone: row.branch_phone },
      })
    }

    res.status(400).json({ error: 'Reference numbers start with LS-BK (bookings) or LS-OR (orders)' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/* ---------- Announcements (posted by superadmin) ---------- */

router.get('/announcements', async (req, res) => {
  const limit = Math.min(20, Number(req.query.limit) || 6)
  try {
    let sql = `SELECT id, title, body, category, is_pinned, published_at
               FROM announcements
               WHERE is_published = true`
    const params = []
    if (req.query.pinned === '1') {
      sql += ` AND is_pinned = true`
    }
    params.push(limit)
    sql += ` ORDER BY is_pinned DESC, published_at DESC LIMIT $${params.length}`
    const { rows } = await db.query(sql, params)
    res.json(rows)
  } catch (err) {
    res.json([]) // table may not exist until migration 003 runs
  }
})

/* ---------- Products ----------
   Medicines are stocked per branch, so the catalog depends on where the
   customer is buying. Every medicine any branch carries is listed; the
   `stock` field is for the chosen branch, and `available_at` names the
   other branches holding it so the page can say "out here, but Novaliches
   has it". */

router.get('/products', async (req, res) => {
  const branchId = req.query.branch_id ? Number(req.query.branch_id) : null

  let products
  try {
    const { rows } = await db.query(
      `SELECT id, name, generic_name, description, category, price, requires_rx, image_url
       FROM products
       WHERE is_active = true
       ORDER BY category, name`
    )
    products = rows
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }

  let inventory
  try {
    const { rows } = await db.query(
      `SELECT branch_id, product_id, stock, is_available
       FROM branch_inventory
       WHERE is_available = true`
    )
    inventory = rows
  } catch (err) {
    /* Before migration 004 there is no per-branch stock — serve the plain catalog. */
    return res.json(products.map((p) => ({ ...p, stock: null, available_at: [] })))
  }

  const stockHere = new Map()
  const availableAt = new Map()
  for (const row of inventory) {
    if (branchId && row.branch_id === branchId) stockHere.set(row.product_id, row.stock)
    if (row.stock > 0) {
      if (!availableAt.has(row.product_id)) availableAt.set(row.product_id, [])
      availableAt.get(row.product_id).push(row.branch_id)
    }
  }

  /* Before a branch is picked the shopper is just browsing, so show the whole
     catalog. Once they pick one, narrow it to medicines that branch carries
     plus anything another branch has in stock — those become the referrals. */
  const listed = branchId
    ? products.filter((p) => stockHere.has(p.id) || availableAt.has(p.id))
    : products

  res.json(
    listed.map((p) => ({
      ...p,
      stock: branchId ? (stockHere.get(p.id) ?? 0) : null,
      available_at: (availableAt.get(p.id) || []).filter((id) => id !== branchId),
    }))
  )
})

/* ---------- Pharmacy branches with payment info (for checkout) ---------- */

router.get('/pharmacies', async (_req, res) => {
  const targetClients = ['Yakap and Gamot - Owned', 'Drug Store - Stand Alone']
  try {
    const { rows } = await db.query(
      `SELECT id, name, target_client, area, province, city, phone, gcash_number, qr_image_url, map_embed_src, latitude, longitude
       FROM branches
       WHERE is_active = true AND target_client = ANY($1)
       ORDER BY area`,
      [targetClients]
    )
    return res.json(rows)
  } catch (err) {
    if (/map_embed_src|latitude|longitude/.test(err.message)) {
      try {
        const { rows: legacy } = await db.query(
          `SELECT id, name, target_client, area, province, city, phone, gcash_number, qr_image_url
           FROM branches
           WHERE is_active = true AND target_client = ANY($1)
           ORDER BY area`,
          [targetClients]
        )
        return res.json(legacy)
      } catch (err2) {
        return res.status(500).json({ error: err2.message })
      }
    }
    return res.status(500).json({ error: err.message })
  }
})

/* ---------- Create order ---------- */

router.post('/orders', async (req, res) => {
  const { branch_id, customer_name, phone, email, philhealth_no, notes, items, payment_method, payment_ref } =
    req.body || {}
  if (!branch_id || !customer_name || !phone || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required order details' })
  }

  try {
    // Recompute total from the database so client-side prices can't be tampered with
    const ids = items.map((i) => i.product_id)
    const { rows: products } = await db.query(
      `SELECT id, name, price FROM products WHERE id = ANY($1) AND is_active = true`,
      [ids]
    )

    const priced = items.map((i) => {
      const p = products.find((x) => x.id === i.product_id)
      if (!p) throw Object.assign(new Error(`Product ${i.product_id} is unavailable`), { status: 409 })
      const qty = Math.max(1, Math.min(99, Number(i.qty) || 1))
      return { product_id: p.id, name: p.name, price: Number(p.price), qty }
    })
    const total = priced.reduce((sum, i) => sum + i.price * i.qty, 0)

    const online = payment_method === 'online'
    const reference = makeReference('LS-OR')

    /* Take the stock down FIRST, one atomic call per medicine. If any line
       fails (someone else bought the last box a second ago) we put back what
       we already took, so a rejected order never eats stock. */
    const reserved = []
    const releaseReserved = async () => {
      for (const item of reserved) {
        await db.query(
          `SELECT adjust_stock(
             p_branch_id := $1, p_product_id := $2, p_delta := $3,
             p_reason := $4, p_note := $5, p_order_reference := $6, p_admin_id := $7
           )`,
          [branch_id, item.product_id, item.qty, 'returned', `Released — order ${reference} not completed`, reference, null]
        )
      }
    }

    for (const item of priced) {
      try {
        await db.query(
          `SELECT adjust_stock(
             p_branch_id := $1, p_product_id := $2, p_delta := $3,
             p_reason := $4, p_note := $5, p_order_reference := $6, p_admin_id := $7
           )`,
          [branch_id, item.product_id, -item.qty, 'online_order', '', reference, null]
        )
        reserved.push(item)
      } catch (stockErr) {
        /* Migration 004 not applied yet — this deployment has no per-branch
           stock, so fall through and record the order as before. */
        if (/adjust_stock|branch_inventory/.test(stockErr.message) && !/STOCK/.test(stockErr.message)) break

        await releaseReserved()
        if (/MEDICINE_NOT_STOCKED/.test(stockErr.message)) {
          return res.status(409).json({ error: `${item.name} is not available at this branch.` })
        }
        if (/INSUFFICIENT_STOCK/.test(stockErr.message)) {
          return res.status(409).json({ error: `${item.name} just went out of stock at this branch. Please adjust your order.` })
        }
        return res.status(500).json({ error: stockErr.message })
      }
    }

    const { rows } = await db.query(
      `INSERT INTO orders
        (reference, branch_id, customer_name, phone, email, philhealth_no, notes, items, total, payment_method, payment_ref, payment_status, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'placed')
       RETURNING reference, total, payment_method, payment_status, status`,
      [
        reference,
        branch_id,
        customer_name,
        phone,
        email || '',
        philhealth_no || '',
        notes || '',
        JSON.stringify(priced),
        total,
        online ? 'online' : 'onsite',
        online ? payment_ref || '' : '',
        online && payment_ref ? 'for_verification' : 'unpaid',
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message })
    res.status(500).json({ error: err.message })
  }
})

export default router