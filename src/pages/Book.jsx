import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { branchBadges } from './Branches.jsx'
import { CheckCircleIcon } from '../components/Icons.jsx'
import PageHeader from '../components/PageHeader.jsx'

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Book() {
  const [params] = useSearchParams()
  const [branches, setBranches] = useState([])
  const [services, setServices] = useState([])
  const [error, setError] = useState('')

  const [branchId, setBranchId] = useState(params.get('branch') ? Number(params.get('branch')) : null)
  const [serviceId, setServiceId] = useState(null)
  const [date, setDate] = useState(todayStr())
  const [slots, setSlots] = useState(null)
  const [time, setTime] = useState(null)
  const [form, setForm] = useState({ patient_name: '', phone: '', email: '', philhealth_no: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState(null)

  useEffect(() => {
    Promise.all([api.get('/branches'), api.get('/services')])
      .then(([b, s]) => {
        setBranches(b.filter((x) => !x.target_client.includes('Drug Store')))
        setServices(s)
      })
      .catch((e) => setError(e.message))
  }, [])

  // load slots whenever branch/date changes
  useEffect(() => {
    setSlots(null)
    setTime(null)
    if (!branchId || !date) return
    api
      .get(`/branches/${branchId}/slots?date=${date}`)
      .then(setSlots)
      .catch((e) => setError(e.message))
  }, [branchId, date])

  const branch = useMemo(() => branches.find((b) => b.id === branchId), [branches, branchId])
  const service = useMemo(() => services.find((s) => s.id === serviceId), [services, serviceId])
  const step = !branchId ? 1 : !serviceId ? 2 : !time ? 3 : 4

  async function submit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const result = await api.post('/bookings', {
        branch_id: branchId,
        service_id: serviceId,
        booking_date: date,
        booking_time: time,
        ...form,
      })
      setConfirmation(result)
    } catch (err) {
      setError(err.message)
      if (err.message.includes('slot')) {
        setTime(null)
        api.get(`/branches/${branchId}/slots?date=${date}`).then(setSlots).catch(() => {})
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmation) {
    return (
      <section className="section page">
        <div className="confirm-card">
          <CheckCircleIcon size={52} className="confirm-icon" />
          <h2>Booking Confirmed!</h2>
          <p>Save your reference number — you'll use it to track or present at the branch:</p>
          <p className="reference">{confirmation.reference}</p>
          <div className="confirm-details">
            <p><strong>{branch?.name}</strong></p>
            <p>{service?.name}</p>
            <p>
              {confirmation.booking_date} at {confirmation.booking_time?.slice(0, 5)}
            </p>
          </div>
          <div className="hero-actions" style={{ justifyContent: 'center' }}>
            <Link to="/track" className="btn btn-primary">Track this Booking</Link>
            <Link to="/" className="btn btn-secondary">Back to Home</Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      <PageHeader eyebrow="Appointments" title="Book an Appointment">
        Choose your preferred branch, service, and time — instant confirmation with a reference number.
      </PageHeader>
    <section className="section page section-tight">
      <div className="steps">
        {['Branch', 'Service', 'Date & Time', 'Your Details'].map((label, i) => (
          <span
            key={label}
            data-num={i + 1}
            className={`step ${step === i + 1 ? 'current' : step > i + 1 ? 'done' : ''}`}
          >
            {label}
          </span>
        ))}
      </div>

      {error && <p className="error-box">{error}</p>}

      {/* Step 1: branch */}
      {step === 1 && (
        <div className="branch-grid">
          {branches.map((b) => (
            <button key={b.id} type="button" className="branch-card selectable" onClick={() => setBranchId(b.id)}>
              <div className="branch-badges">
                {branchBadges(b.target_client).map((badge) => (
                  <span key={badge.label} className={`badge ${badge.cls}`}>{badge.label}</span>
                ))}
              </div>
              <h3>{b.name}</h3>
              <p className="branch-loc">{b.city}, {b.province}</p>
            </button>
          ))}
          {branches.length === 0 && !error && <p className="muted center">Loading branches…</p>}
        </div>
      )}

      {/* Step 2: service */}
      {step === 2 && (
        <>
          <p className="picked">
            Branch: <strong>{branch?.name}</strong>{' '}
            <button className="link-btn" onClick={() => setBranchId(null)}>change</button>
          </p>
          <div className="services-grid">
            {services.map((s) => (
              <button key={s.id} type="button" className="service-card selectable" onClick={() => setServiceId(s.id)}>
                <h3>{s.name}</h3>
                <p>{s.description}</p>
                <p className="muted">{s.duration_min} minutes</p>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Step 3: date & slot */}
      {step === 3 && (
        <>
          <p className="picked">
            <strong>{branch?.name}</strong> · {service?.name}{' '}
            <button className="link-btn" onClick={() => setServiceId(null)}>change</button>
          </p>
          <div className="filter-bar">
            <label>
              Date:{' '}
              <input type="date" value={date} min={todayStr()} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          {!slots && <p className="muted center">Checking availability…</p>}
          {slots && !slots.open && <p className="error-box">This branch is closed on that date — try another day.</p>}
          {slots?.open && (
            <div className="slot-grid">
              {slots.slots.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  className="slot"
                  disabled={!s.available}
                  onClick={() => setTime(s.time)}
                >
                  {s.time}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Step 4: details */}
      {step === 4 && (
        <>
          <p className="picked">
            <strong>{branch?.name}</strong> · {service?.name} · {date} at {time}{' '}
            <button className="link-btn" onClick={() => setTime(null)}>change</button>
          </p>
          <form className="form-card" onSubmit={submit}>
            <label>
              Full name *
              <input
                required
                value={form.patient_name}
                onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
              />
            </label>
            <label>
              Mobile number *
              <input
                required
                type="tel"
                placeholder="09XX XXX XXXX"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label>
              Email (optional)
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label>
              PhilHealth number (optional)
              <input
                value={form.philhealth_no}
                onChange={(e) => setForm({ ...form, philhealth_no: e.target.value })}
              />
            </label>
            <label>
              Notes for the clinic (optional)
              <textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Booking…' : 'Confirm Booking'}
            </button>
          </form>
        </>
      )}
    </section>
    </>
  )
}
