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
  const empty = { name: '', target_client: 'Yakap only', area: '', province: '', city: '', address: '', phone: '' }
  const [form, setForm] = useState(empty)

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

  return (
    <>
      {error && <p className="error-box">{error}</p>}
      <form className="inline-form" onSubmit={add}>
        <input required placeholder="Branch name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select value={form.target_client} onChange={(e) => setForm({ ...form, target_client: e.target.value })}>
          <option>Yakap only</option>
          <option>Yakap and Gamot - Owned</option>
          <option>Drug Store - Stand Alone</option>
        </select>
        <input required placeholder="Area (e.g. NCR and Rizal)" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
        <input required placeholder="Province" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
        <input required placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <button type="submit" className="btn btn-primary btn-sm">Add Branch</button>
      </form>
      <table className="admin-table">
        <thead>
          <tr><th>Name</th><th>Type</th><th>Area</th><th>Province</th><th>City</th><th>Active</th></tr>
        </thead>
        <tbody>
          {items.map((b) => (
            <tr key={b.id} className={b.is_active ? '' : 'row-muted'}>
              <td>{b.name}</td>
              <td>{b.target_client}</td>
              <td>{b.area}</td>
              <td>{b.province}</td>
              <td>{b.city}</td>
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

function AccountsTab() {
  const { items, error, setError, load } = useCrud('/admins')
  const [branches, setBranches] = useState([])
  const empty = { username: '', password: '', display_name: '', role: 'branch', branch_id: '' }
  const [form, setForm] = useState(empty)

  useEffect(() => {
    adminApi.get('/branches').then(setBranches).catch(() => {})
  }, [])

  async function add(e) {
    e.preventDefault()
    try {
      await adminApi.post('/admins', { ...form, branch_id: form.branch_id ? Number(form.branch_id) : null })
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
      <form className="inline-form" onSubmit={add}>
        <input required placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input required type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <input placeholder="Display name" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="branch">Branch admin</option>
          <option value="super">Corporate admin</option>
        </select>
        {form.role === 'branch' && (
          <select required value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
            <option value="">Assign branch…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        <button type="submit" className="btn btn-primary btn-sm">Add Account</button>
      </form>
      <table className="admin-table">
        <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Branch</th><th>Active</th></tr></thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className={a.is_active ? '' : 'row-muted'}>
              <td>{a.username}</td>
              <td>{a.display_name}</td>
              <td>{a.role}</td>
              <td>{a.branches?.name || '—'}</td>
              <td><button type="button" onClick={() => toggle(a)}>{a.is_active ? 'Deactivate' : 'Activate'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
