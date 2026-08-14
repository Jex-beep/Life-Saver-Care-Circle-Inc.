import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi, peso } from '../../api.js'
import { useAdmin } from './AdminRoutes.jsx'
import { PillIcon, SearchIcon, BuildingIcon } from '../../components/Icons.jsx'

/**
 * Medicine stock, which each branch keeps for itself.
 *
 *   manager — decides what this branch carries, stocks deliveries in,
 *             and can look up stock at every other branch to refer a
 *             patient somewhere that has what they need
 *   handler — rings up walk-in sales, which takes stock down. Website
 *             orders already decrement on their own; this is for the
 *             medicines sold over the counter.
 */

const REASON_LABELS = {
  stock_in: 'Stock in',
  walkin_sale: 'Walk-in sale',
  online_order: 'Website order',
  adjustment: 'Correction',
  expired: 'Expired',
  damaged: 'Damaged',
  returned: 'Returned',
}

/* What a handler is allowed to record — all of these take stock down. */
const HANDLER_REASONS = ['walkin_sale', 'expired', 'damaged']
const MANAGER_REASONS = ['walkin_sale', 'adjustment', 'expired', 'damaged', 'returned']

function stockState(row) {
  if (row.stock === 0) return 'out'
  if (row.stock <= row.low_stock_at) return 'low'
  return 'ok'
}

/* ---------------- Sell / remove stock ---------------- */

function MoveStockRow({ row, canStockIn, onDone, onError }) {
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState(canStockIn ? 'walkin_sale' : 'walkin_sale')
  const [busy, setBusy] = useState(false)

  const reasons = canStockIn ? MANAGER_REASONS : HANDLER_REASONS

  async function move(direction) {
    const n = Number(qty)
    if (!Number.isInteger(n) || n <= 0) {
      onError('Enter how many units, as a whole number.')
      return
    }
    if (direction < 0 && n > row.stock) {
      onError(`Only ${row.stock} left — you cannot remove ${n}.`)
      return
    }
    setBusy(true)
    try {
      await adminApi.post(`/inventory/${row.id}/adjust`, {
        delta: direction * n,
        reason: direction > 0 ? 'stock_in' : reason,
      })
      setQty('')
      onDone()
    } catch (e) {
      onError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stock-move">
      <input
        type="number"
        min="1"
        className="stock-qty"
        placeholder="Qty"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        aria-label={`Quantity for ${row.products?.name}`}
      />
      <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason">
        {reasons.map((r) => (
          <option key={r} value={r}>{REASON_LABELS[r]}</option>
        ))}
      </select>
      <button type="button" className="btn btn-secondary btn-sm" disabled={busy || row.stock === 0} onClick={() => move(-1)}>
        Remove
      </button>
      {canStockIn && (
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => move(1)}>
          Stock in
        </button>
      )}
    </div>
  )
}

/* ---------------- This branch's shelf ---------------- */

function BranchStock({ canStockIn, branchId }) {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    const q = branchId ? `?branch_id=${branchId}` : ''
    setLoading(true)
    adminApi
      .get(`/inventory${q}`)
      .then((data) => {
        setRows(data)
        setError('')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [branchId])

  useEffect(load, [load])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((r) =>
      `${r.products?.name} ${r.products?.generic_name} ${r.products?.category}`.toLowerCase().includes(term)
    )
  }, [rows, search])

  const lowCount = rows.filter((r) => stockState(r) !== 'ok').length

  async function toggleAvailable(row) {
    try {
      await adminApi.patch(`/inventory/${row.id}`, { is_available: !row.is_available })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading && rows.length === 0) return <p className="muted">Loading stock…</p>

  return (
    <>
      {error && <p className="error-box">{error}</p>}

      {canStockIn && <AddMedicine branchId={branchId} onAdded={load} onError={setError} />}

      <div className="inv-toolbar">
        <label className="inv-search">
          <SearchIcon size={16} />
          <input
            type="search"
            placeholder="Search medicine or generic name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search this branch's medicines"
          />
        </label>
        {lowCount > 0 && (
          <span className="inv-alert">
            {lowCount} {lowCount === 1 ? 'medicine needs' : 'medicines need'} restocking
          </span>
        )}
      </div>

      {rows.length === 0 && (
        <p className="muted">
          This branch does not carry any medicines yet.
          {canStockIn
            ? ' Add the first one above — enter the quantity that actually arrived.'
            : ' Ask your branch manager to add them.'}
        </p>
      )}

      {rows.length > 0 && (
        <table className="admin-table inv-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Category</th>
              <th>Price</th>
              <th>On hand</th>
              <th>{canStockIn ? 'Move stock' : 'Record sale'}</th>
              {canStockIn && <th>Shown online</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const state = stockState(row)
              return (
                <tr key={row.id} className={row.is_available ? '' : 'row-muted'}>
                  <td>
                    <strong>{row.products?.name}</strong>
                    {row.products?.generic_name && <div className="muted small">{row.products.generic_name}</div>}
                    {row.products?.requires_rx && <span className="rx-chip">Rx</span>}
                  </td>
                  <td>{row.products?.category}</td>
                  <td>{peso(row.products?.price)}</td>
                  <td>
                    <span className={`stock-pill stock-pill-${state}`}>
                      {row.stock}
                      {state === 'out' && ' · out'}
                      {state === 'low' && ' · low'}
                    </span>
                  </td>
                  <td>
                    <MoveStockRow row={row} canStockIn={canStockIn} onDone={load} onError={setError} />
                  </td>
                  {canStockIn && (
                    <td>
                      <button type="button" onClick={() => toggleAvailable(row)}>
                        {row.is_available ? 'Hide' : 'Show'}
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {filtered.length === 0 && rows.length > 0 && <p className="muted">No medicine matches "{search}".</p>}
    </>
  )
}

/* ---------------- Start carrying a medicine ---------------- */

function AddMedicine({ branchId, onAdded, onError }) {
  const [catalog, setCatalog] = useState([])
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('existing') // existing | new
  const [productId, setProductId] = useState('')
  const [stock, setStock] = useState('')
  const [busy, setBusy] = useState(false)
  const blank = { name: '', generic_name: '', category: 'General', price: '', requires_rx: false }
  const [fresh, setFresh] = useState(blank)

  useEffect(() => {
    if (open && catalog.length === 0) {
      adminApi.get('/catalog').then(setCatalog).catch(() => {})
    }
  }, [open, catalog.length])

  async function submit(e) {
    e.preventDefault()
    const opening = Number(stock)
    if (!Number.isInteger(opening) || opening < 0) {
      onError('Opening stock must be a whole number.')
      return
    }
    setBusy(true)
    try {
      const body = { opening_stock: opening, ...(branchId ? { branch_id: branchId } : {}) }
      if (mode === 'existing') {
        if (!productId) throw new Error('Choose a medicine from the list.')
        body.product_id = Number(productId)
      } else {
        body.product = { ...fresh, price: Number(fresh.price) }
      }
      await adminApi.post('/inventory', body)
      setProductId('')
      setStock('')
      setFresh(blank)
      setOpen(false)
      onAdded()
    } catch (e) {
      onError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-primary btn-sm inv-add-toggle" onClick={() => setOpen(true)}>
        <PillIcon size={16} /> Add a medicine to this branch
      </button>
    )
  }

  return (
    <form className="inv-add" onSubmit={submit}>
      <div className="inv-add-head">
        <h3>Add a medicine to this branch</h3>
        <button type="button" className="link-btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>

      <div className="inv-mode">
        <label className="radio">
          <input type="radio" checked={mode === 'existing'} onChange={() => setMode('existing')} />
          Already in the system
        </label>
        <label className="radio">
          <input type="radio" checked={mode === 'new'} onChange={() => setMode('new')} />
          Brand new medicine
        </label>
      </div>

      {mode === 'existing' ? (
        <select required value={productId} onChange={(e) => setProductId(e.target.value)} aria-label="Medicine">
          <option value="">Choose a medicine…</option>
          {catalog.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.generic_name && `(${p.generic_name})`} — {peso(p.price)}
            </option>
          ))}
        </select>
      ) : (
        <div className="inline-form">
          <input required placeholder="Brand name" value={fresh.name} onChange={(e) => setFresh({ ...fresh, name: e.target.value })} />
          <input placeholder="Generic name" value={fresh.generic_name} onChange={(e) => setFresh({ ...fresh, generic_name: e.target.value })} />
          <input placeholder="Category" value={fresh.category} onChange={(e) => setFresh({ ...fresh, category: e.target.value })} />
          <input required type="number" step="0.01" min="0" placeholder="Price" style={{ width: 110 }} value={fresh.price} onChange={(e) => setFresh({ ...fresh, price: e.target.value })} />
          <label className="radio">
            <input type="checkbox" checked={fresh.requires_rx} onChange={(e) => setFresh({ ...fresh, requires_rx: e.target.checked })} /> Rx
          </label>
        </div>
      )}

      <label className="inv-opening">
        How many arrived?
        <input required type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="e.g. 50" />
      </label>
      <p className="muted small">
        Enter the quantity physically on your shelf. Stock is never carried over from another branch.
      </p>

      <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
        {busy ? 'Adding…' : 'Add to this branch'}
      </button>
    </form>
  )
}

/* ---------------- Stock across the network (referral lookup) ---------------- */

function NetworkStock() {
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi
      .get('/inventory/network')
      .then((data) => {
        setRows(data)
        setError('')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase()
    const matching = term
      ? rows.filter((r) => `${r.medicine} ${r.generic_name}`.toLowerCase().includes(term))
      : rows
    const map = new Map()
    for (const row of matching) {
      if (!map.has(row.product_id)) {
        map.set(row.product_id, { medicine: row.medicine, generic_name: row.generic_name, price: row.price, branches: [] })
      }
      map.get(row.product_id).branches.push(row)
    }
    return [...map.values()]
  }, [rows, search])

  return (
    <>
      {error && <p className="error-box">{error}</p>}
      <p className="muted">
        Every branch holding stock right now. Use this to tell a patient where they can get what you are out of.
      </p>

      <label className="inv-search">
        <SearchIcon size={16} />
        <input
          type="search"
          placeholder="Search a medicine across all branches…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search medicines across all branches"
        />
      </label>

      {loading && <p className="muted">Loading network stock…</p>}
      {!loading && grouped.length === 0 && (
        <p className="muted">{search ? `No branch currently has "${search}".` : 'No branch has stock on hand yet.'}</p>
      )}

      <div className="inv-network">
        {grouped.map((group) => (
          <div key={group.medicine} className="adm-card inv-network-card">
            <div className="inv-network-head">
              <div>
                <strong>{group.medicine}</strong>
                {group.generic_name && <span className="muted small"> · {group.generic_name}</span>}
              </div>
              <span className="product-price">{peso(group.price)}</span>
            </div>
            <ul className="inv-network-list">
              {group.branches.map((b) => (
                <li key={`${b.branch_id}-${b.product_id}`}>
                  <BuildingIcon size={14} />
                  <span className="inv-network-branch">{b.branch_name}</span>
                  <span className="muted small">{b.city}, {b.province}</span>
                  {b.phone && <a href={`tel:${b.phone.replace(/\s/g, '')}`}>{b.phone}</a>}
                  <span className="stock-pill stock-pill-ok">{b.stock} on hand</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  )
}

/* ---------------- Stock history ---------------- */

function StockHistory({ branchId }) {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const q = branchId ? `?branch_id=${branchId}` : ''
    adminApi.get(`/stock-movements${q}`).then(setRows).catch((e) => setError(e.message))
  }, [branchId])

  if (error) return <p className="error-box">{error}</p>
  if (rows.length === 0) return <p className="muted">No stock movements recorded yet.</p>

  return (
    <table className="admin-table">
      <thead>
        <tr><th>When</th><th>Medicine</th><th>Change</th><th>Left</th><th>Reason</th><th>By</th></tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.id}>
            <td className="muted small">{new Date(m.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
            <td>{m.products?.name}</td>
            <td className={m.delta > 0 ? 'delta-in' : 'delta-out'}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
            <td>{m.stock_after}</td>
            <td>
              {REASON_LABELS[m.reason] || m.reason}
              {m.order_reference && <code className="small"> {m.order_reference}</code>}
              {m.note && <div className="muted small">{m.note}</div>}
            </td>
            <td className="muted small">{m.admins?.display_name || 'Website'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ---------------- Page ---------------- */

export default function Inventory() {
  const { admin, isSuper } = useAdmin()
  const isManager = admin.role === 'manager' || isSuper
  const [tab, setTab] = useState('branch')
  const [branches, setBranches] = useState([])
  /* A superadmin has no branch of their own, so they pick one to work on. */
  const [branchId, setBranchId] = useState(null)

  useEffect(() => {
    if (!isSuper) return
    adminApi.get('/branches').then((list) => {
      setBranches(list)
      setBranchId((current) => current ?? list[0]?.id ?? null)
    }).catch(() => {})
  }, [isSuper])

  const tabs = [
    { id: 'branch', label: isSuper ? 'Branch stock' : 'My branch' },
    ...(isManager ? [{ id: 'network', label: 'All branches' }] : []),
    { id: 'history', label: 'History' },
  ]

  return (
    <>
      <h2>Medicine Stock</h2>
      <p className="muted">
        {isManager
          ? 'You decide what this branch carries and record deliveries. Stock at other branches is shown so you can point patients somewhere that has what they need.'
          : 'Record medicines sold over the counter here. Orders placed on the website already take themselves out of stock.'}
      </p>

      {isSuper && branches.length > 0 && (
        <label className="inv-branch-pick">
          Working on
          <select value={branchId || ''} onChange={(e) => setBranchId(Number(e.target.value))}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
      )}

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'branch' && <BranchStock key={branchId} canStockIn={isManager} branchId={branchId} />}
      {tab === 'network' && isManager && <NetworkStock />}
      {tab === 'history' && <StockHistory branchId={branchId} />}
    </>
  )
}
