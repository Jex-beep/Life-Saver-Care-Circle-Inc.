import { useEffect, useState } from 'react'
import { adminApi } from '../../api.js'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function Schedule() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    adminApi.get('/schedule').then(setRows).catch((e) => setError(e.message))
  }, [])

  function edit(weekday, field, value) {
    setRows((prev) => prev.map((r) => (r.weekday === weekday ? { ...r, [field]: value } : r)))
  }

  async function save(row) {
    setError('')
    setSaved('')
    try {
      await adminApi.put(`/schedule/${row.weekday}`, {
        open_time: row.open_time,
        close_time: row.close_time,
        slot_minutes: Number(row.slot_minutes),
        capacity: Number(row.capacity),
        is_open: row.is_open,
      })
      setSaved(`${DAYS[row.weekday]} saved`)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <h2>Weekly Schedule</h2>
      <p className="muted">
        These hours control the time slots customers can book. Capacity = how many bookings per slot.
      </p>
      {error && <p className="error-box">{error}</p>}
      {saved && <p className="success-box">{saved}</p>}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>Open?</th>
            <th>Opens</th>
            <th>Closes</th>
            <th>Slot (mins)</th>
            <th>Capacity</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.weekday} className={r.is_open ? '' : 'row-muted'}>
              <td><strong>{DAYS[r.weekday]}</strong></td>
              <td>
                <input
                  type="checkbox"
                  checked={r.is_open}
                  onChange={(e) => edit(r.weekday, 'is_open', e.target.checked)}
                />
              </td>
              <td>
                <input
                  type="time"
                  value={r.open_time?.slice(0, 5)}
                  onChange={(e) => edit(r.weekday, 'open_time', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="time"
                  value={r.close_time?.slice(0, 5)}
                  onChange={(e) => edit(r.weekday, 'close_time', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="10"
                  max="120"
                  step="5"
                  value={r.slot_minutes}
                  onChange={(e) => edit(r.weekday, 'slot_minutes', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={r.capacity}
                  onChange={(e) => edit(r.weekday, 'capacity', e.target.value)}
                />
              </td>
              <td>
                <button type="button" onClick={() => save(r)}>Save</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
