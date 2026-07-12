import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '../../api.js'
import useStagger from '../../components/bits/useStagger.js'

const CATEGORIES = [
  { value: 'news', label: 'News' },
  { value: 'hiring', label: 'Hiring' },
  { value: 'advisory', label: 'Advisory' },
]

const EMPTY = { id: null, title: '', body: '', category: 'news', is_published: true, is_pinned: false }

export default function Announcements() {
  const [items, setItems] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [migrationNeeded, setMigrationNeeded] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    adminApi
      .get('/announcements')
      .then((data) => { setItems(data); setMigrationNeeded(false) })
      .catch((e) => {
        if (e.message.includes('not set up yet')) setMigrationNeeded(true)
        else setError(e.message)
      })
  }, [])

  useEffect(load, [load])
  useStagger('.ann-admin-row', [items])

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = {
        title: form.title,
        body: form.body,
        category: form.category,
        is_published: form.is_published,
        is_pinned: form.is_pinned,
      }
      if (form.id) await adminApi.patch(`/announcements/${form.id}`, body)
      else await adminApi.post('/announcements', body)
      setForm(EMPTY)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggle(item, field) {
    try {
      await adminApi.patch(`/announcements/${item.id}`, { [field]: !item[field] })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return
    try {
      await adminApi.delete(`/announcements/${item.id}`)
      if (form.id === item.id) setForm(EMPTY)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (migrationNeeded) {
    return (
      <section className="adm-card adm-panel">
        <h2>Announcements</h2>
        <p className="muted" style={{ maxWidth: '60ch' }}>
          This feature needs a one-time database update. Open your Supabase dashboard, go to{' '}
          <strong>SQL Editor</strong>, paste the contents of <code>supabase/migration-003-announcements.sql</code>,
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
          <h2>{form.id ? 'Edit Announcement' : 'Post an Announcement'}</h2>
          {form.id && (
            <button type="button" className="adm-preset" onClick={() => setForm(EMPTY)}>
              Cancel editing
            </button>
          )}
        </div>
        <p className="muted adm-panel-sub">
          Published posts appear in the homepage News &amp; Announcements section. Pinning a post also shows it as a
          bar at the top of every page — only one post can be pinned at a time.
        </p>

        <form className="ann-form" onSubmit={save}>
          <div className="ann-form-row">
            <label className="grow">
              Title
              <input
                required
                maxLength={140}
                placeholder="e.g. We are hiring nurses for our Cavite branches"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              Category
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Details
            <textarea
              rows={5}
              placeholder="Write the full announcement. Line breaks are kept."
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </label>
          <div className="ann-form-row">
            <label className="ann-check">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
              />
              Published (visible on the website)
            </label>
            <label className="ann-check">
              <input
                type="checkbox"
                checked={form.is_pinned}
                onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
              />
              Pin to the top bar
            </label>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Saving…' : form.id ? 'Save Changes' : 'Publish Announcement'}
            </button>
          </div>
        </form>
      </section>

      <section className="adm-card adm-panel">
        <div className="adm-panel-head">
          <h2>All Posts</h2>
        </div>
        {items === null && <p className="muted">Loading…</p>}
        {Array.isArray(items) && items.length === 0 && <p className="muted">No announcements yet.</p>}
        {Array.isArray(items) &&
          items.map((a) => (
            <div key={a.id} className="ann-admin-row">
              <div className="ann-admin-meta">
                <span className={`ann-chip ann-${a.category}`}>{a.category}</span>
                <strong>{a.title}</strong>
                <span className="ann-admin-date">
                  {new Date(a.published_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {!a.is_published && <span className="pill pill-unpaid">draft</span>}
                {a.is_pinned && <span className="pill pill-confirmed">pinned</span>}
              </div>
              <div className="row-actions">
                <button onClick={() => setForm({ ...a })}>Edit</button>
                <button onClick={() => toggle(a, 'is_published')}>{a.is_published ? 'Unpublish' : 'Publish'}</button>
                <button onClick={() => toggle(a, 'is_pinned')}>{a.is_pinned ? 'Unpin' : 'Pin'}</button>
                <button className="danger" onClick={() => remove(a)}>Delete</button>
              </div>
            </div>
          ))}
      </section>
    </>
  )
}
