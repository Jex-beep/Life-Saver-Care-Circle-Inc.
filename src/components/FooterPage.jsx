import { useState } from 'react'
import { Link } from 'react-router-dom'
import { STATIC_MODE } from '../config.js'
import { api } from '../api.js'
import { PhoneIcon, MailIcon, FacebookIcon, CalendarIcon } from './Icons.jsx'

const REASONS = [
  { id: 'book', label: 'Book a clinic visit' },
  { id: 'yakap', label: 'Ask about Yakap' },
  { id: 'order', label: 'Order or track medicines' },
  { id: 'branch', label: 'Find the nearest branch' },
]

/* Full-viewport contact/footer page used as the last page of every route. */
export default function FooterPage() {
  const [form, setForm] = useState({ name: '', mobile: '', reason: 'book', message: '' })
  const [status, setStatus] = useState('idle') // idle | sending | sent | error

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (STATIC_MODE) return
    setStatus('sending')
    try {
      await api.post('/inquiries', form)
      setStatus('sent')
      setForm({ name: '', mobile: '', reason: 'book', message: '' })
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="fpage2">
      <div className="fpage2-grid">
        {/* Left column: contact methods */}
        <div className="fpage2-col">
          <a href="tel:+639325688028" className="cm-card">
            <span className="cm-num">01</span>
            <h3><PhoneIcon size={18} className="inline-icon" /> Call the care desk</h3>
            <p className="cm-value">0932 568 8028</p>
            <p className="cm-note">Best for same-day visits and urgent branch questions.</p>
          </a>

          <a href="mailto:info@lscarecircle.com.ph" className="cm-card">
            <span className="cm-num">02</span>
            <h3><MailIcon size={18} className="inline-icon" /> Email support</h3>
            <p className="cm-value">info@lscarecircle.com.ph</p>
            <p className="cm-note">Use this for documents, partnerships, and longer requests.</p>
          </a>

          <a
            href="https://www.facebook.com/LifeSaverServicesPH"
            target="_blank"
            rel="noopener noreferrer"
            className="cm-card"
          >
            <span className="cm-num">03</span>
            <h3><FacebookIcon size={18} className="inline-icon" /> Facebook updates</h3>
            <p className="cm-value">Life Saver Services PH</p>
            <p className="cm-note">Message the team and follow announcements from branches.</p>
          </a>

          <div className="cm-card cm-card-dark">
            <span className="cm-eyebrow">Clinic hours</span>
            <h3 className="cm-hours-title">Monday to Saturday</h3>
            <p>8:00 AM to 5:00 PM. Availability may vary by branch and service.</p>
          </div>
        </div>

        {/* Right column: request form */}
        <div className="cm-form-card">
          <div className="cm-form-head">
            <div>
              <h2>Send a request</h2>
              <p>Use this layout for appointments, pharmacy questions, and branch inquiries.</p>
            </div>
            {!STATIC_MODE && (
              <Link to="/track" className="cm-form-link">Response queue</Link>
            )}
          </div>

          <form onSubmit={handleSubmit} className="cm-form">
            <div className="cm-form-row">
              <label>
                Full name
                <input
                  type="text"
                  placeholder="Juan dela Cruz"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  required
                />
              </label>
              <label>
                Mobile number
                <input
                  type="tel"
                  placeholder="09XX XXX XXXX"
                  value={form.mobile}
                  onChange={(e) => update('mobile', e.target.value)}
                  required
                />
              </label>
            </div>

            <fieldset className="cm-reason">
              <legend>Reason for contacting</legend>
              <div className="cm-reason-grid">
                {REASONS.map((r) => (
                  <label key={r.id} className={`cm-reason-option ${form.reason === r.id ? 'is-active' : ''}`}>
                    <input
                      type="radio"
                      name="reason"
                      value={r.id}
                      checked={form.reason === r.id}
                      onChange={() => update('reason', r.id)}
                    />
                    <span className="cm-reason-dot" />
                    {r.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label>
              Message
              <textarea
                rows={4}
                placeholder="Tell us your preferred branch, service, and schedule."
                value={form.message}
                onChange={(e) => update('message', e.target.value)}
              />
            </label>

            {status === 'sent' && <p className="success-box">Your request has been sent — we'll get back to you shortly.</p>}
            {status === 'error' && <p className="error-box">Something went wrong. Please try again or call the care desk.</p>}

            <div className="cm-form-actions">
              <button type="submit" className="btn btn-primary" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : 'Send request'}
              </button>
              {STATIC_MODE ? (
                <Link to="/branches" className="btn btn-secondary">Find a Yakap Clinic</Link>
              ) : (
                <Link to="/book" className="btn btn-secondary">Book instead</Link>
              )}
            </div>
          </form>
        </div>
      </div>

      {!STATIC_MODE && (
        <div className="cm-track-banner">
          <div>
            <span className="cm-eyebrow">Need order status?</span>
            <h3>Track a booking or pharmacy request without calling the branch.</h3>
          </div>
          <Link to="/track" className="btn btn-light">Go to tracking</Link>
        </div>
      )}

      <p className="fpage-note">
        © 2026 Life Saver · Yakap: PhilHealth-accredited Primary Care Facility · Gamot: pharmacy where PhilHealth
        members may avail of medicines
        {!STATIC_MODE && (
          <>
            {' '}· <Link to="/admin">Staff login</Link>
          </>
        )}
      </p>
    </div>
  )
}