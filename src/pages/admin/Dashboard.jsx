import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../api.js'
import { useAdmin } from './AdminRoutes.jsx'

export default function Dashboard() {
  const { admin, isSuper } = useAdmin()
  const [summary, setSummary] = useState(null)
  const [todayBookings, setTodayBookings] = useState([])
  const [error, setError] = useState('')
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  useEffect(() => {
    adminApi.get('/summary').then(setSummary).catch((e) => setError(e.message))
    adminApi
      .get(`/bookings?date=${today}`)
      .then(setTodayBookings)
      .catch((e) => setError(e.message))
  }, [today])

  return (
    <>
      <h2>Dashboard</h2>
      <p className="muted">Welcome back, {admin.display_name}</p>
      {error && <p className="error-box">{error}</p>}

      {summary && (
        <div className="stat-cards">
          <Link to="/admin/bookings" className="stat-card">
            <span className="stat-big">{summary.todayBookings}</span> bookings today
          </Link>
          <Link to="/admin/orders" className="stat-card">
            <span className="stat-big">{summary.openOrders}</span> open orders
          </Link>
          <Link to="/admin/orders" className="stat-card warn">
            <span className="stat-big">{summary.paymentsToVerify}</span> payments to verify
          </Link>
        </div>
      )}

      <h3>Today's Bookings</h3>
      {todayBookings.length === 0 && <p className="muted">No bookings scheduled today.</p>}
      {todayBookings.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Reference</th>
              <th>Patient</th>
              <th>Service</th>
              {isSuper && <th>Branch</th>}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {todayBookings.map((b) => (
              <tr key={b.id}>
                <td>{b.booking_time?.slice(0, 5)}</td>
                <td><code>{b.reference}</code></td>
                <td>{b.patient_name}</td>
                <td>{b.services?.name}</td>
                {isSuper && <td>{b.branches?.name}</td>}
                <td><span className={`pill pill-${b.status}`}>{b.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
