import { Router } from 'express'
import { db } from '../supabase.js'
import { makeReference, buildSlots, localDateStr, timeToMinutes, minutesToTime } from '../helpers.js'

const router = Router()

/* capacity_blocks is added by migration 002 — treat a missing table as "no blocks" */
async function getBlocks(branchId, fromDate, toDate) {
  const { data, error } = await db
    .from('capacity_blocks')
    .select('*')
    .eq('branch_id', branchId)
    .gte('block_date', fromDate)
    .lte('block_date', toDate)
    .order('start_time')
  if (error) return []
  return data
}

const pad2 = (n) => String(n).padStart(2, '0')

function inBlock(block, timeStr) {
  const t = timeToMinutes(timeStr)
  return t >= timeToMinutes(block.start_time) && t < timeToMinutes(block.end_time)
}

/* ---------- Branches ---------- */

router.get('/branches', async (_req, res) => {
  const { data, error } = await db
    .from('branches')
    .select('id, name, target_client, area, province, city, address, phone')
    .eq('is_active', true)
    .order('area')
    .order('province')
    .order('city')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

/* ---------- Services ---------- */

router.get('/services', async (_req, res) => {
  const { data, error } = await db
    .from('services')
    .select('id, name, description, duration_min')
    .eq('is_active', true)
    .order('sort_order')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
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

  const [{ data: schedules, error: schedErr }, blocks, { data: bookings, error: bookErr }] = await Promise.all([
    db.from('branch_schedules').select('*').eq('branch_id', branchId),
    getBlocks(branchId, first, last),
    db
      .from('bookings')
      .select('booking_date')
      .eq('branch_id', branchId)
      .gte('booking_date', first)
      .lte('booking_date', last)
      .neq('status', 'cancelled'),
  ])
  if (schedErr) return res.status(500).json({ error: schedErr.message })
  if (bookErr) return res.status(500).json({ error: bookErr.message })

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
})

/* ---------- Available slots for a branch on a date ---------- */

router.get('/branches/:id/slots', async (req, res) => {
  const branchId = Number(req.params.id)
  const date = req.query.date // YYYY-MM-DD
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' })
  }
  const weekday = new Date(`${date}T00:00:00`).getDay()

  const [{ data: schedule, error: schedErr }, dayBlocks, { data: booked, error: bookErr }] = await Promise.all([
    db.from('branch_schedules').select('*').eq('branch_id', branchId).eq('weekday', weekday).maybeSingle(),
    getBlocks(branchId, date, date),
    db
      .from('bookings')
      .select('booking_time')
      .eq('branch_id', branchId)
      .eq('booking_date', date)
      .neq('status', 'cancelled'),
  ])
  if (schedErr) return res.status(500).json({ error: schedErr.message })
  if (bookErr) return res.status(500).json({ error: bookErr.message })

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
})

/* ---------- Create booking (instant confirmation) ---------- */

router.post('/bookings', async (req, res) => {
  const { branch_id, service_id, booking_date, booking_time, patient_name, phone, email, philhealth_no, notes } =
    req.body || {}
  if (!branch_id || !service_id || !booking_date || !booking_time || !patient_name || !phone) {
    return res.status(400).json({ error: 'Missing required booking details' })
  }

  // Re-check the slot is still free (schedule + capacity blocks)
  const weekday = new Date(`${booking_date}T00:00:00`).getDay()
  const [{ data: schedule }, dayBlocks, { data: dayBookings }] = await Promise.all([
    db
      .from('branch_schedules')
      .select('capacity, is_open')
      .eq('branch_id', branch_id)
      .eq('weekday', weekday)
      .maybeSingle(),
    getBlocks(branch_id, booking_date, booking_date),
    db
      .from('bookings')
      .select('booking_time')
      .eq('branch_id', branch_id)
      .eq('booking_date', booking_date)
      .neq('status', 'cancelled'),
  ])

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
  const { data, error } = await db
    .from('bookings')
    .insert({
      reference,
      branch_id,
      service_id,
      booking_date,
      booking_time,
      patient_name,
      phone,
      email: email || '',
      philhealth_no: philhealth_no || '',
      notes: notes || '',
      status: 'confirmed',
    })
    .select('reference, booking_date, booking_time, status')
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

/* ---------- Track booking or order by reference ---------- */

router.get('/track/:reference', async (req, res) => {
  const ref = req.params.reference.trim().toUpperCase()

  if (ref.startsWith('LS-BK')) {
    const { data, error } = await db
      .from('bookings')
      .select(
        'reference, booking_date, booking_time, patient_name, status, created_at, branches(name, city, phone), services(name)'
      )
      .eq('reference', ref)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'No booking found with that reference number' })
    return res.json({ type: 'booking', ...data })
  }

  if (ref.startsWith('LS-OR')) {
    const { data, error } = await db
      .from('orders')
      .select(
        'reference, customer_name, items, total, payment_method, payment_status, status, created_at, branches(name, city, phone)'
      )
      .eq('reference', ref)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'No order found with that reference number' })
    return res.json({ type: 'order', ...data })
  }

  res.status(400).json({ error: 'Reference numbers start with LS-BK (bookings) or LS-OR (orders)' })
})

/* ---------- Products ---------- */

router.get('/products', async (_req, res) => {
  const { data, error } = await db
    .from('products')
    .select('id, name, generic_name, description, category, price, requires_rx, image_url')
    .eq('is_active', true)
    .order('category')
    .order('name')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

/* ---------- Pharmacy branches with payment info (for checkout) ---------- */

router.get('/pharmacies', async (_req, res) => {
  const { data, error } = await db
    .from('branches')
    .select('id, name, area, province, city, gcash_number, qr_image_url')
    .eq('is_active', true)
    .in('target_client', ['Yakap and Gamot - Owned', 'Drug Store - Stand Alone'])
    .order('area')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

/* ---------- Create order ---------- */

router.post('/orders', async (req, res) => {
  const { branch_id, customer_name, phone, email, philhealth_no, notes, items, payment_method, payment_ref } =
    req.body || {}
  if (!branch_id || !customer_name || !phone || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required order details' })
  }

  // Recompute total from the database so client-side prices can't be tampered with
  const ids = items.map((i) => i.product_id)
  const { data: products, error: prodErr } = await db
    .from('products')
    .select('id, name, price')
    .in('id', ids)
    .eq('is_active', true)
  if (prodErr) return res.status(500).json({ error: prodErr.message })

  const priced = items.map((i) => {
    const p = products.find((x) => x.id === i.product_id)
    if (!p) throw Object.assign(new Error(`Product ${i.product_id} is unavailable`), { status: 409 })
    const qty = Math.max(1, Math.min(99, Number(i.qty) || 1))
    return { product_id: p.id, name: p.name, price: Number(p.price), qty }
  })
  const total = priced.reduce((sum, i) => sum + i.price * i.qty, 0)

  const online = payment_method === 'online'
  const reference = makeReference('LS-OR')
  const { data, error } = await db
    .from('orders')
    .insert({
      reference,
      branch_id,
      customer_name,
      phone,
      email: email || '',
      philhealth_no: philhealth_no || '',
      notes: notes || '',
      items: priced,
      total,
      payment_method: online ? 'online' : 'onsite',
      payment_ref: online ? payment_ref || '' : '',
      payment_status: online && payment_ref ? 'for_verification' : 'unpaid',
      status: 'placed',
    })
    .select('reference, total, payment_method, payment_status, status')
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

export default router
