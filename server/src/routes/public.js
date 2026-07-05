import { Router } from 'express'
import { db } from '../supabase.js'
import { makeReference, buildSlots, localDateStr } from '../helpers.js'

const router = Router()

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

/* ---------- Available slots for a branch on a date ---------- */

router.get('/branches/:id/slots', async (req, res) => {
  const branchId = Number(req.params.id)
  const date = req.query.date // YYYY-MM-DD
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' })
  }
  const weekday = new Date(`${date}T00:00:00`).getDay()

  const { data: schedule, error: schedErr } = await db
    .from('branch_schedules')
    .select('*')
    .eq('branch_id', branchId)
    .eq('weekday', weekday)
    .maybeSingle()
  if (schedErr) return res.status(500).json({ error: schedErr.message })
  if (!schedule || !schedule.is_open) return res.json({ open: false, slots: [] })

  const { data: booked, error: bookErr } = await db
    .from('bookings')
    .select('booking_time')
    .eq('branch_id', branchId)
    .eq('booking_date', date)
    .neq('status', 'cancelled')
  if (bookErr) return res.status(500).json({ error: bookErr.message })

  const counts = {}
  for (const b of booked) counts[b.booking_time.slice(0, 5)] = (counts[b.booking_time.slice(0, 5)] || 0) + 1

  const now = new Date()
  const isToday = date === localDateStr(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const slots = buildSlots(schedule).map((time) => {
    const [h, m] = time.split(':').map(Number)
    const past = isToday && h * 60 + m <= nowMinutes
    return {
      time,
      available: !past && (counts[time] || 0) < schedule.capacity,
    }
  })

  res.json({ open: true, slots })
})

/* ---------- Create booking (instant confirmation) ---------- */

router.post('/bookings', async (req, res) => {
  const { branch_id, service_id, booking_date, booking_time, patient_name, phone, email, philhealth_no, notes } =
    req.body || {}
  if (!branch_id || !service_id || !booking_date || !booking_time || !patient_name || !phone) {
    return res.status(400).json({ error: 'Missing required booking details' })
  }

  // Re-check the slot is still free (capacity)
  const weekday = new Date(`${booking_date}T00:00:00`).getDay()
  const { data: schedule } = await db
    .from('branch_schedules')
    .select('capacity, is_open')
    .eq('branch_id', branch_id)
    .eq('weekday', weekday)
    .maybeSingle()
  if (!schedule || !schedule.is_open) return res.status(409).json({ error: 'Branch is closed on that date' })

  const { count } = await db
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', branch_id)
    .eq('booking_date', booking_date)
    .eq('booking_time', booking_time)
    .neq('status', 'cancelled')
  if ((count || 0) >= schedule.capacity) {
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
