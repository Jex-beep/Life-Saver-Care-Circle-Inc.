import { useCallback, useEffect, useState } from 'react'
import { adminApi, peso } from '../../api.js'

const TABS = ['Branches', 'Services', 'Medicines', 'Accounts']

export default function Manage() {
  const [tab, setTab] = useState('Branches')
  return (
    <>
      <h2>Manage System</h2>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} type="button" className={tab === t ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Branches' && <BranchesTab />}
      {tab === 'Services' && <ServicesTab />}
      {tab === 'Medicines' && <MedicinesTab />}
      {tab === 'Accounts' && <AccountsTab />}
    </>
  )
}

function useCrud(path) {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const load = useCallback(() => {
    adminApi.get(path).then(setItems).catch((e) => setError(e.message))
  }, [path])
  useEffect(load, [load])
  return { items, error, setError, load }
}

/* ---------------- Branches ---------------- */

function BranchesTab() {
  const { items, error, setError, load } = useCrud('/branches')
  const empty = {
    name: '', target_client: 'Yakap only', area: '', province: '', city: '',
    address: '', phone: '', map_embed: '',
  }
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null) // branch id whose map is being replaced
  const [mapDraft, setMapDraft] = useState('')

  async function add(e) {
    e.preventDefault()
    try {
      await adminApi.post('/branches', form)
      setForm(empty)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggle(b) {
    try {
      await adminApi.patch(`/branches/${b.id}`, { is_active: !b.is_active })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function saveMap(branchId) {
    try {
      await adminApi.patch(`/branches/${branchId}`, { map_embed: mapDraft })
      setEditing(null)
      setMapDraft('')
      setError('')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      {error && <p className="error-box">{error}</p>}

      <form className="branch-add" onSubmit={add}>
        <div className="inline-form">
          <input required placeholder="Branch name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select value={form.target_client} onChange={(e) => setForm({ ...form, target_client: e.target.value })}>
            <option>Yakap only</option>
            <option>Yakap and Gamot - Owned</option>
            <option>Drug Store - Stand Alone</option>
          </select>
          <input required placeholder="Area (e.g. NCR and Rizal)" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          <input required placeholder="Province" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
          <input required placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>

        <label className="map-field">
          <span className="map-field-label">Location on the map</span>
          <span className="muted small">
            In Google Maps, find the branch, then <strong>Share → Embed a map → Copy HTML</strong> and paste it here.
            This is how the site knows where the branch is when someone searches for the nearest Yakap or Gamot.
          </span>
          <textarea
            rows="3"
            placeholder={'<iframe src="https://www.google.com/maps/embed?pb=…" width="600" height="450" …></iframe>'}
            value={form.map_embed}
            onChange={(e) => setForm({ ...form, map_embed: e.target.value })}
          />
        </label>

        <button type="submit" className="btn btn-primary btn-sm">Add Branch</button>
      </form>

      <table className="admin-table">
        <thead>
          <tr><th>Name</th><th>Type</th><th>Area</th><th>City</th><th>Map</th><th>Active</th></tr>
        </thead>
        <tbody>
          {items.map((b) => (
            <tr key={b.id} className={b.is_active ? '' : 'row-muted'}>
              <td>{b.name}</td>
              <td>{b.target_client}</td>
              <td>{b.area}</td>
              <td>{b.city}, {b.province}</td>
              <td>
                {editing === b.id ? (
                  <div className="map-edit">
                    <textarea
                      rows="2"
                      placeholder="Paste the Google Maps embed HTML"
                      value={mapDraft}
                      onChange={(e) => setMapDraft(e.target.value)}
                    />
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => saveMap(b.id)}>Save</button>
                    <button type="button" className="link-btn" onClick={() => { setEditing(null); setMapDraft('') }}>Cancel</button>
                  </div>
                ) : (
                  <>
                    {b.latitude && b.longitude ? (
                      <span className="map-set" title={`${b.latitude}, ${b.longitude}`}>Pinned</span>
                    ) : (
                      <span className="map-unset">Using city centre</span>
                    )}{' '}
                    <button type="button" onClick={() => { setEditing(b.id); setMapDraft('') }}>
                      {b.latitude ? 'Replace' : 'Set map'}
                    </button>
                  </>
                )}
              </td>
              <td><button type="button" onClick={() => toggle(b)}>{b.is_active ? 'Deactivate' : 'Activate'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/* ---------------- Services ---------------- */

function ServicesTab() {
  const { items, error, setError, load } = useCrud('/services')
  const empty = { name: '', description: '', duration_min: 30 }
  const [form, setForm] = useState(empty)

  async function add(e) {
    e.preventDefault()
    try {
      await adminApi.post('/services', { ...form, duration_min: Number(form.duration_min) })
      setForm(empty)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggle(s) {
    try {
      await adminApi.patch(`/services/${s.id}`, { is_active: !s.is_active })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      {error && <p className="error-box">{error}</p>}
      <form className="inline-form" onSubmit={add}>
        <input required placeholder="Service name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input type="number" min="10" step="5" style={{ width: 90 }} value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} />
        <button type="submit" className="btn btn-primary btn-sm">Add Service</button>
      </form>
      <table className="admin-table">
        <thead><tr><th>Service</th><th>Description</th><th>Duration</th><th>Active</th></tr></thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id} className={s.is_active ? '' : 'row-muted'}>
              <td>{s.name}</td>
              <td>{s.description}</td>
              <td>{s.duration_min} min</td>
              <td><button type="button" onClick={() => toggle(s)}>{s.is_active ? 'Deactivate' : 'Activate'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/* ---------------- Medicines ---------------- */

function MedicinesTab() {
  const { items, error, setError, load } = useCrud('/products')
  const empty = { name: '', generic_name: '', category: 'General', price: '', requires_rx: false }
  const [form, setForm] = useState(empty)

  async function add(e) {
    e.preventDefault()
    try {
      await adminApi.post('/products', { ...form, price: Number(form.price) })
      setForm(empty)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggle(p) {
    try {
      await adminApi.patch(`/products/${p.id}`, { is_active: !p.is_active })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      {error && <p className="error-box">{error}</p>}
      <p className="muted">
        The master medicine list and its prices, shared by every branch. How many units a branch actually
        has is set per branch under <strong>Medicine Stock</strong>, where you can pick a branch and stock it.
      </p>
      <form className="inline-form" onSubmit={add}>
        <input required placeholder="Brand name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Generic name" value={form.generic_name} onChange={(e) => setForm({ ...form, generic_name: e.target.value })} />
        <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <input required type="number" step="0.01" min="0" placeholder="Price" style={{ width: 100 }} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <label className="radio">
          <input type="checkbox" checked={form.requires_rx} onChange={(e) => setForm({ ...form, requires_rx: e.target.checked })} /> ℞
        </label>
        <button type="submit" className="btn btn-primary btn-sm">Add Medicine</button>
      </form>
      <table className="admin-table">
        <thead><tr><th>Medicine</th><th>Generic</th><th>Category</th><th>Price</th><th>℞</th><th>Active</th></tr></thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className={p.is_active ? '' : 'row-muted'}>
              <td>{p.name}</td>
              <td>{p.generic_name}</td>
              <td>{p.category}</td>
              <td>{peso(p.price)}</td>
              <td>{p.requires_rx ? 'Yes' : ''}</td>
              <td><button type="button" onClick={() => toggle(p)}>{p.is_active ? 'Deactivate' : 'Activate'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/* ---------------- Accounts ---------------- */

/* Each branch runs on two accounts. Spelling out what each one can do here
   saves the superadmin from guessing when they create staff logins. */
const ROLE_OPTIONS = [
  {
    value: 'manager',
    label: 'Branch manager',
    blurb: 'Adds the medicines this branch carries, records deliveries, and can check stock at every other branch to refer patients.',
  },
  {
    value: 'handler',
    label: 'Branch handler',
    blurb: 'Prepares orders and bookings, and takes stock down for walk-in sales. Cannot add medicines or change branch settings.',
  },
  {
    value: 'super',
    label: 'Corporate admin',
    blurb: 'Sees every branch, creates accounts, and manages branches, services, and medicines.',
  },
]

const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]))

function AccountsTab() {
  const { items, error, setError, load } = useCrud('/admins')
  const [branches, setBranches] = useState([])
  const empty = { username: '', password: '', display_name: '', role: 'manager', branch_id: '' }
  const [form, setForm] = useState(empty)

  useEffect(() => {
    adminApi.get('/branches').then(setBranches).catch(() => {})
  }, [])

  const selectedRole = ROLE_OPTIONS.find((r) => r.value === form.role)
  const needsBranch = form.role !== 'super'

  /* Which branches still need one of each account, so gaps are visible at a glance. */
  const staffing = branches.map((b) => {
    const staff = items.filter((a) => a.branch_id === b.id && a.is_active)
    return {
      ...b,
      hasManager: staff.some((a) => a.role === 'manager'),
      hasHandler: staff.some((a) => a.role === 'handler'),
    }
  })
  const incomplete = staffing.filter((b) => b.is_active && (!b.hasManager || !b.hasHandler))

  async function add(e) {
    e.preventDefault()
    try {
      await adminApi.post('/admins', {
        ...form,
        branch_id: needsBranch && form.branch_id ? Number(form.branch_id) : null,
      })
      setForm(empty)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggle(a) {
    try {
      await adminApi.patch(`/admins/${a.id}`, { is_active: !a.is_active })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      {error && <p className="error-box">{error}</p>}

      {incomplete.length > 0 && (
        <div className="staffing-note">
          <strong>Branches still missing an account:</strong>
          <ul>
            {incomplete.map((b) => (
              <li key={b.id}>
                {b.name} — needs {[!b.hasManager && 'a manager', !b.hasHandler && 'a handler'].filter(Boolean).join(' and ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form className="account-add" onSubmit={add}>
        <div className="inline-form">
          <input required placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input required type="password" minLength={8} placeholder="Password (min 8)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input placeholder="Display name" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          {needsBranch && (
            <select required value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
              <option value="">Assign branch…</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <button type="submit" className="btn btn-primary btn-sm">Add Account</button>
        </div>
        {selectedRole && <p className="muted small role-blurb">{selectedRole.blurb}</p>}
      </form>

      <table className="admin-table">
        <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Branch</th><th>Active</th></tr></thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className={a.is_active ? '' : 'row-muted'}>
              <td>{a.username}</td>
              <td>{a.display_name}</td>
              <td>{ROLE_LABELS[a.role] || a.role}</td>
              <td>{a.branches?.name || '—'}</td>
              <td><button type="button" onClick={() => toggle(a)}>{a.is_active ? 'Deactivate' : 'Activate'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
