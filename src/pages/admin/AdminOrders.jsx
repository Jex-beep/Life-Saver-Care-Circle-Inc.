import { useCallback, useEffect, useState } from 'react'
import { adminApi, peso } from '../../api.js'
import { useAdmin } from './AdminRoutes.jsx'

const NEXT_STATUS = { placed: 'preparing', preparing: 'ready', ready: 'completed' }
const NEXT_LABEL = { placed: 'Start preparing', preparing: 'Mark ready', ready: 'Complete' }

export default function AdminOrders() {
  const { isSuper } = useAdmin()
  const [orders, setOrders] = useState([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(() => {
    const q = status ? `?status=${status}` : ''
    adminApi.get(`/orders${q}`).then(setOrders).catch((e) => setError(e.message))
  }, [status])

  useEffect(load, [load])

  async function update(id, body) {
    try {
      await adminApi.patch(`/orders/${id}`, body)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <h2>Pharmacy Orders</h2>
      {error && <p className="error-box">{error}</p>}
      <div className="filter-bar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="placed">Placed</option>
          <option value="preparing">Preparing</option>
          <option value="ready">Ready</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="order-cards">
        {orders.map((o) => (
          <div key={o.id} className="order-card">
            <div className="order-head">
              <code>{o.reference}</code>
              <span className={`pill pill-${o.status}`}>{o.status}</span>
            </div>
            <p>
              <strong>{o.customer_name}</strong> · {o.phone}
              {isSuper && <span className="muted"> · {o.branches?.name}</span>}
            </p>
            {o.philhealth_no && <p className="muted small">PhilHealth: {o.philhealth_no}</p>}
            <ul className="order-items">
              {o.items.map((i) => (
                <li key={i.product_id}>
                  {i.qty} × {i.name} — {peso(i.price * i.qty)}
                </li>
              ))}
            </ul>
            {o.notes && <p className="muted small">Note: {o.notes}</p>}
            <p>
              <strong>{peso(o.total)}</strong> ·{' '}
              {o.payment_method === 'online' ? `Online${o.payment_ref ? ` (ref ${o.payment_ref})` : ''}` : 'Pay at branch'} ·{' '}
              <span className={`pill pill-${o.payment_status}`}>{o.payment_status.replace('_', ' ')}</span>
            </p>
            <div className="row-actions">
              {o.payment_status === 'for_verification' && (
                <button onClick={() => update(o.id, { payment_status: 'paid' })}>Verify payment</button>
              )}
              {o.payment_status === 'unpaid' && o.status !== 'cancelled' && (
                <button onClick={() => update(o.id, { payment_status: 'paid' })}>Mark paid</button>
              )}
              {NEXT_STATUS[o.status] && (
                <button onClick={() => update(o.id, { status: NEXT_STATUS[o.status] })}>
                  {NEXT_LABEL[o.status]}
                </button>
              )}
              {['placed', 'preparing'].includes(o.status) && (
                <button className="danger" onClick={() => update(o.id, { status: 'cancelled' })}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {orders.length === 0 && <p className="muted">No orders found.</p>}
    </>
  )
}
