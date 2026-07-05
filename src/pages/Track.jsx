import { useState } from 'react'
import { api, peso } from '../api.js'

const STATUS_LABELS = {
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Marked as no-show',
  placed: 'Order received',
  preparing: 'Being prepared',
  ready: 'Ready for pickup',
}

export default function Track() {
  const [ref, setRef] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function lookup(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    try {
      setResult(await api.get(`/track/${encodeURIComponent(ref.trim())}`))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="section page page-narrow">
      <h2>Track Your Booking or Order</h2>
      <p className="section-sub">
        Enter the reference number you received — bookings start with <code>LS-BK</code>, pharmacy orders with{' '}
        <code>LS-OR</code>.
      </p>

      <form className="track-form" onSubmit={lookup}>
        <input
          required
          placeholder="e.g. LS-BK-7F3K2M"
          value={ref}
          onChange={(e) => setRef(e.target.value.toUpperCase())}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Searching…' : 'Track'}
        </button>
      </form>

      {error && <p className="error-box">{error}</p>}

      {result?.type === 'booking' && (
        <div className="confirm-card">
          <h3>Booking {result.reference}</h3>
          <p className="status-line">{STATUS_LABELS[result.status] || result.status}</p>
          <div className="confirm-details">
            <p><strong>{result.branches?.name}</strong> ({result.branches?.city})</p>
            <p>{result.services?.name}</p>
            <p>{result.booking_date} at {result.booking_time?.slice(0, 5)}</p>
            <p>Patient: {result.patient_name}</p>
            {result.branches?.phone && <p>Branch phone: {result.branches.phone}</p>}
          </div>
        </div>
      )}

      {result?.type === 'order' && (
        <div className="confirm-card">
          <h3>Order {result.reference}</h3>
          <p className="status-line">{STATUS_LABELS[result.status] || result.status}</p>
          <div className="confirm-details">
            <p><strong>{result.branches?.name}</strong> ({result.branches?.city})</p>
            <ul className="order-items">
              {result.items.map((i) => (
                <li key={i.product_id}>
                  {i.qty} × {i.name} — {peso(i.price * i.qty)}
                </li>
              ))}
            </ul>
            <p><strong>Total: {peso(result.total)}</strong></p>
            <p>
              Payment: {result.payment_method === 'online' ? 'Online' : 'Pay at branch'} ·{' '}
              {result.payment_status === 'paid'
                ? 'Paid'
                : result.payment_status === 'for_verification'
                  ? 'Being verified'
                  : 'Unpaid'}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
