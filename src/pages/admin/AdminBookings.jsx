import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '../../api.js'
import { useAdmin } from './AdminRoutes.jsx'

export default function AdminBookings() {
  const { isSuper } = useAdmin()
  const [bookings, setBookings] = useState([])
  const [date, setDate] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(() => {
    const q = new URLSearchParams()
    if (date) q.set('date', date)
    if (status) q.set('status', status)
    adminApi.get(`/bookings?${q}`).then(setBookings).catch((e) => setError(e.message))
  }, [date, status])

  useEffect(load, [load])

  async function setBookingStatus(id, newStatus) {
    try {
      await adminApi.patch(`/bookings/${id}`, { status: newStatus })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <h2>Bookings</h2>
      {error && <p className="error-box">{error}</p>}
      <div className="filter-bar">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No-show</option>
        </select>
        <button type="button" className="link-btn" onClick={() => { setDate(''); setStatus('') }}>
          clear filters
        </button>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Reference</th>
            <th>Patient</th>
            <th>Contact</th>
            <th>Service</th>
            {isSuper && <th>Branch</th>}
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id}>
              <td>{b.booking_date}</td>
              <td>{b.booking_time?.slice(0, 5)}</td>
              <td><code>{b.reference}</code></td>
              <td>
                {b.patient_name}
                {b.philhealth_no && <div className="muted small">PH: {b.philhealth_no}</div>}
              </td>
              <td>
                {b.phone}
                {b.email && <div className="muted small">{b.email}</div>}
              </td>
              <td>{b.services?.name}</td>
              {isSuper && <td>{b.branches?.name}</td>}
              <td><span className={`pill pill-${b.status}`}>{b.status}</span></td>
              <td className="row-actions">
                {b.status === 'confirmed' && (
                  <>
                    <button onClick={() => setBookingStatus(b.id, 'completed')}>Complete</button>
                    <button onClick={() => setBookingStatus(b.id, 'no_show')}>No-show</button>
                    <button className="danger" onClick={() => setBookingStatus(b.id, 'cancelled')}>Cancel</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {bookings.length === 0 && <p className="muted">No bookings found.</p>}
    </>
  )
}
