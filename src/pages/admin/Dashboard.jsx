import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../api.js'
import { useAdmin } from './AdminRoutes.jsx'
import CountUp from '../../components/bits/CountUp.jsx'
import useStagger from '../../components/bits/useStagger.js'
import { CalendarIcon, PillIcon, GaugeIcon } from '../../components/Icons.jsx'

const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Dashboard() {
  const { isSuper } = useAdmin()
  const [summary, setSummary] = useState(null)
  const [todayBookings, setTodayBookings] = useState([])
  const [sessions, setSessions] = useState(null) // null = loading, [] = none, false = migration missing
  const [error, setError] = useState('')
  const today = localToday()

  useEffect(() => {
    adminApi.get('/summary').then(setSummary).catch((e) => setError(e.message))
    adminApi.get(`/bookings?date=${today}`).then(setTodayBookings).catch((e) => setError(e.message))
    if (!isSuper) {
      adminApi
        .get(`/capacity-blocks?from=${today}&to=${today}`)
        .then(setSessions)
        .catch(() => setSessions(false))
    } else {
      setSessions([])
    }
  }, [today, isSuper])

  useStagger('.adm-card', [summary !== null])

  return (
    <>
      {error && <p className="error-box">{error}</p>}

      <div className="adm-kpis">
        <div className="adm-card adm-kpi">
          <span className="adm-kpi-icon"><CalendarIcon size={20} /></span>
          <div>
            <span className="adm-kpi-value">
              {summary ? <CountUp to={summary.todayBookings} duration={1.2} /> : '—'}
            </span>
            <span className="adm-kpi-label">Bookings today</span>
          </div>
          <Link to="/admin/bookings" className="adm-kpi-link">View</Link>
        </div>
        <div className="adm-card adm-kpi">
          <span className="adm-kpi-icon"><PillIcon size={20} /></span>
          <div>
            <span className="adm-kpi-value">
              {summary ? <CountUp to={summary.openOrders} duration={1.2} /> : '—'}
            </span>
            <span className="adm-kpi-label">Open orders</span>
          </div>
          <Link to="/admin/orders" className="adm-kpi-link">View</Link>
        </div>
        <div className={`adm-card adm-kpi ${summary?.paymentsToVerify > 0 ? 'is-warn' : ''}`}>
          <span className="adm-kpi-icon"><GaugeIcon size={20} /></span>
          <div>
            <span className="adm-kpi-value">
              {summary ? <CountUp to={summary.paymentsToVerify} duration={1.2} /> : '—'}
            </span>
            <span className="adm-kpi-label">Payments to verify</span>
          </div>
          <Link to="/admin/orders" className="adm-kpi-link">Review</Link>
        </div>
      </div>

      {!isSuper && (
        <section className="adm-card adm-panel">
          <div className="adm-panel-head">
            <h2>Today's Sessions</h2>
            <Link to="/admin/capacity" className="adm-kpi-link">Manage capacity</Link>
          </div>
          {sessions === null && <p className="muted">Loading…</p>}
          {sessions === false && (
            <p className="muted">
              Capacity sessions are not set up yet — run <code>migration-002-capacity-blocks.sql</code> in Supabase
              to enable per-date patient limits.
            </p>
          )}
          {Array.isArray(sessions) && sessions.length === 0 && (
            <p className="muted">
              No sessions defined for today — the weekly schedule applies. Add sessions in{' '}
              <Link to="/admin/capacity">Capacity</Link> to limit patients per time window.
            </p>
          )}
          {Array.isArray(sessions) && sessions.length > 0 && (
            <div className="adm-sessions">
              {sessions.map((s) => {
                const pct = s.max_patients === 0 ? 100 : Math.min(100, Math.round((s.booked / s.max_patients) * 100))
                return (
                  <div key={s.id} className="adm-session">
                    <div className="adm-session-meta">
                      <strong>{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</strong>
                      {s.note && <span>{s.note}</span>}
                      <span className="adm-session-count">
                        {s.max_patients === 0 ? 'Closed' : `${s.booked} / ${s.max_patients} booked`}
                      </span>
                    </div>
                    <div className="adm-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <span
                        className={`adm-progress-fill ${pct >= 100 ? 'is-full' : pct >= 80 ? 'is-warn' : ''}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      <section className="adm-card adm-panel">
        <div className="adm-panel-head">
          <h2>Today's Bookings</h2>
          <Link to="/admin/bookings" className="adm-kpi-link">All bookings</Link>
        </div>
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
                  <td className="mono">{b.booking_time?.slice(0, 5)}</td>
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
      </section>
    </>
  )
}
