import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '../../api.js'
import { useAdmin } from './AdminRoutes.jsx'
import useStagger from '../../components/bits/useStagger.js'

const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PRESETS = [
  { label: 'Morning clinic', start: '08:00', end: '12:00', max: 20 },
  { label: 'Afternoon clinic', start: '14:00', end: '17:00', max: 35 },
  { label: 'Whole day', start: '08:00', end: '17:00', max: 50 },
]

export default function Capacity() {
  const { isSuper } = useAdmin()
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [blocks, setBlocks] = useState(null)
  const [error, setError] = useState('')
  const [migrationNeeded, setMigrationNeeded] = useState(false)
  const [form, setForm] = useState({ block_date: localToday(), start_time: '08:00', end_time: '12:00', max_patients: 20, note: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isSuper) adminApi.get('/branches').then(setBranches).catch(() => {})
  }, [isSuper])

  const load = useCallback(() => {
    const q = new URLSearchParams({ from: localToday() })
    if (isSuper) {
      if (!branchId) return
      q.set('branch_id', branchId)
    }
    adminApi
      .get(`/capacity-blocks?${q}`)
      .then((data) => { setBlocks(data); setMigrationNeeded(false) })
      .catch((e) => {
        if (e.message.includes('not set up yet')) setMigrationNeeded(true)
        else setError(e.message)
      })
  }, [isSuper, branchId])

  useEffect(load, [load])
  useStagger('.adm-block-row', [blocks])

  async function addBlock(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = { ...form, max_patients: Number(form.max_patients) }
      if (isSuper) body.branch_id = Number(branchId)
      await adminApi.post('/capacity-blocks', body)
      setForm((f) => ({ ...f, note: '' }))
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(block) {
    if (block.booked > 0 && !window.confirm(`${block.booked} patient(s) already booked in this session. Removing the limit will not cancel their bookings. Continue?`)) {
      return
    }
    try {
      await adminApi.delete(`/capacity-blocks/${block.id}`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const applyPreset = (p) => setForm((f) => ({ ...f, start_time: p.start, end_time: p.end, max_patients: p.max, note: p.label }))

  /* group upcoming blocks by date */
  const grouped = (blocks || []).reduce((acc, b) => {
    ;(acc[b.block_date] = acc[b.block_date] || []).push(b)
    return acc
  }, {})

  if (migrationNeeded) {
    return (
      <section className="adm-card adm-panel">
        <h2>Capacity &amp; Sessions</h2>
        <p className="muted" style={{ maxWidth: '60ch' }}>
          This feature needs a one-time database update. Open your Supabase dashboard, go to{' '}
          <strong>SQL Editor</strong>, paste the contents of <code>supabase/migration-002-capacity-blocks.sql</code>,
          and click Run. Then reload this page.
        </p>
      </section>
    )
  }

  return (
    <>
      {error && <p className="error-box">{error}</p>}

      <section className="adm-card adm-panel">
        <div className="adm-panel-head">
          <h2>Add a Session</h2>
        </div>
        <p className="muted adm-panel-sub">
          Sessions cap how many patients can book within a time window on a specific date — e.g. 22 July, 8:00–12:00,
          20 patients. Dates with sessions show live availability on the public booking calendar. A date without
          sessions follows your weekly schedule. Set max patients to 0 to close a window.
        </p>

        <div className="adm-presets">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="adm-preset" onClick={() => applyPreset(p)}>
              {p.label} · {p.start}–{p.end} · {p.max}
            </button>
          ))}
        </div>

        <form className="adm-block-form" onSubmit={addBlock}>
          {isSuper && (
            <label>
              Branch
              <select required value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Choose branch…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Date
            <input
              type="date"
              required
              min={localToday()}
              value={form.block_date}
              onChange={(e) => setForm({ ...form, block_date: e.target.value })}
            />
          </label>
          <label>
            Starts
            <input type="time" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          </label>
          <label>
            Ends
            <input type="time" required value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
          </label>
          <label>
            Max patients
            <input
              type="number"
              required
              min="0"
              max="500"
              value={form.max_patients}
              onChange={(e) => setForm({ ...form, max_patients: e.target.value })}
            />
          </label>
          <label className="grow">
            Label (optional)
            <input
              placeholder="e.g. Morning clinic"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving || (isSuper && !branchId)}>
            {saving ? 'Adding…' : 'Add Session'}
          </button>
        </form>
      </section>

      <section className="adm-card adm-panel">
        <div className="adm-panel-head">
          <h2>Upcoming Sessions</h2>
        </div>
        {blocks === null && !isSuper && <p className="muted">Loading…</p>}
        {isSuper && !branchId && <p className="muted">Choose a branch above to view its sessions.</p>}
        {Array.isArray(blocks) && blocks.length === 0 && (
          <p className="muted">No upcoming sessions — all dates follow the weekly schedule.</p>
        )}
        {Object.entries(grouped).map(([date, list]) => (
          <div key={date} className="adm-block-day">
            <p className="adm-block-date">
              {new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            {list.map((b) => {
              const pct = b.max_patients === 0 ? 100 : Math.min(100, Math.round((b.booked / b.max_patients) * 100))
              return (
                <div key={b.id} className="adm-block-row">
                  <div className="adm-session-meta">
                    <strong className="mono">{b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}</strong>
                    {b.note && <span>{b.note}</span>}
                    <span className="adm-session-count">
                      {b.max_patients === 0 ? 'Closed' : `${b.booked} / ${b.max_patients} booked · ${b.remaining} left`}
                    </span>
                  </div>
                  <div className="adm-progress">
                    <span
                      className={`adm-progress-fill ${pct >= 100 ? 'is-full' : pct >= 80 ? 'is-warn' : ''}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <button type="button" className="adm-block-delete" onClick={() => remove(b)}>
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </section>
    </>
  )
}
