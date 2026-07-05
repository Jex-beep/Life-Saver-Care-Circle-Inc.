const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I

/* Local-timezone YYYY-MM-DD (toISOString would give the UTC date) */
export function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function makeReference(prefix) {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)]
  }
  return `${prefix}-${code}`
}

/* "08:00:00" -> minutes since midnight */
export function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/* minutes since midnight -> "08:30" */
export function minutesToTime(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0')
  const m = String(min % 60).padStart(2, '0')
  return `${h}:${m}`
}

/* Generate the slot times for one schedule row */
export function buildSlots(schedule) {
  const slots = []
  const open = timeToMinutes(schedule.open_time)
  const close = timeToMinutes(schedule.close_time)
  for (let t = open; t + schedule.slot_minutes <= close; t += schedule.slot_minutes) {
    slots.push(minutesToTime(t))
  }
  return slots
}
