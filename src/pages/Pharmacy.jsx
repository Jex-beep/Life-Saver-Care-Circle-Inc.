import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, peso } from '../api.js'
import { useCart } from '../context/CartContext.jsx'
import { PillIcon } from '../components/Icons.jsx'

export default function Pharmacy() {
  const [params] = useSearchParams()
  const cart = useCart()

  const [pharmacies, setPharmacies] = useState([])
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')

  const [branchId, setBranchId] = useState(params.get('branch') ? Number(params.get('branch')) : null)
  const [checkingOut, setCheckingOut] = useState(false)
  const [form, setForm] = useState({ customer_name: '', phone: '', email: '', philhealth_no: '', notes: '' })
  const [paymentMethod, setPaymentMethod] = useState('onsite')
  const [paymentRef, setPaymentRef] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState(null)

  useEffect(() => {
    Promise.all([api.get('/pharmacies'), api.get('/products')])
      .then(([ph, pr]) => {
        setPharmacies(ph)
        setProducts(pr)
      })
      .catch((e) => setError(e.message))
  }, [])

  const branch = useMemo(() => pharmacies.find((p) => p.id === branchId), [pharmacies, branchId])
  const categories = useMemo(() => ['All', ...new Set(products.map((p) => p.category))], [products])
  const filtered = products.filter(
    (p) =>
      (category === 'All' || p.category === category) &&
      (search === '' || `${p.name} ${p.generic_name}`.toLowerCase().includes(search.toLowerCase()))
  )

  async function submitOrder(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const result = await api.post('/orders', {
        branch_id: branchId,
        items: cart.items,
        payment_method: paymentMethod,
        payment_ref: paymentRef,
        ...form,
      })
      setConfirmation(result)
      cart.clear()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmation) {
    return (
      <section className="section page">
        <div className="confirm-card">
          <PillIcon size={52} className="confirm-icon" />
          <h2>Order Placed!</h2>
          <p>Your reference number:</p>
          <p className="reference">{confirmation.reference}</p>
          <div className="confirm-details">
            <p><strong>{branch?.name}</strong></p>
            <p>Total: <strong>{peso(confirmation.total)}</strong></p>
            <p>
              {confirmation.payment_method === 'online'
                ? confirmation.payment_status === 'for_verification'
                  ? 'The branch will verify your payment and prepare your order.'
                  : 'Send your payment to the branch account, then track your order.'
                : 'Pay at the branch when you pick up your order.'}
            </p>
          </div>
          <div className="hero-actions" style={{ justifyContent: 'center' }}>
            <Link to="/track" className="btn btn-primary">Track this Order</Link>
            <Link to="/pharmacy" className="btn btn-secondary" onClick={() => setConfirmation(null)}>
              New Order
            </Link>
          </div>
        </div>
      </section>
    )
  }

  /* ---------- Checkout view ---------- */
  if (checkingOut) {
    const onlineAvailable = branch && (branch.qr_image_url || branch.gcash_number)
    return (
      <section className="section page page-narrow">
        <h2>Checkout</h2>
        <p className="picked">
          Pharmacy: <strong>{branch?.name}</strong>{' '}
          <button className="link-btn" onClick={() => setCheckingOut(false)}>back to catalog</button>
        </p>

        <div className="cart-summary">
          {cart.items.map((i) => (
            <div key={i.product_id} className="cart-row">
              <span>{i.qty} × {i.name}</span>
              <span>{peso(i.price * i.qty)}</span>
            </div>
          ))}
          <div className="cart-row cart-total">
            <span>Total</span>
            <span>{peso(cart.total)}</span>
          </div>
        </div>

        {error && <p className="error-box">{error}</p>}

        <form className="form-card" onSubmit={submitOrder}>
          <label>
            Full name *
            <input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
          </label>
          <label>
            Mobile number *
            <input required type="tel" placeholder="09XX XXX XXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label>
            Email (optional)
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>
            PhilHealth number (optional)
            <input value={form.philhealth_no} onChange={(e) => setForm({ ...form, philhealth_no: e.target.value })} />
          </label>
          <label>
            Notes — e.g. prescription details (optional)
            <textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>

          <fieldset className="pay-options">
            <legend>Payment</legend>
            <label className="radio">
              <input
                type="radio"
                name="pay"
                checked={paymentMethod === 'onsite'}
                onChange={() => setPaymentMethod('onsite')}
              />
              Pay at the branch (cash / GCash on pickup)
            </label>
            <label className={`radio ${onlineAvailable ? '' : 'disabled'}`}>
              <input
                type="radio"
                name="pay"
                disabled={!onlineAvailable}
                checked={paymentMethod === 'online'}
                onChange={() => setPaymentMethod('online')}
              />
              Pay online now {onlineAvailable ? '' : '— not yet available for this branch'}
            </label>

            {paymentMethod === 'online' && onlineAvailable && (
              <div className="online-pay">
                {branch.qr_image_url && (
                  <img src={branch.qr_image_url} alt="Branch payment QR code" className="pay-qr" />
                )}
                {branch.gcash_number && <p>GCash: <strong>{branch.gcash_number}</strong></p>}
                <p className="muted">
                  Scan / send your payment, then enter the reference number from your e-wallet receipt:
                </p>
                <label>
                  Payment reference number *
                  <input required value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
                </label>
              </div>
            )}
          </fieldset>

          <button type="submit" className="btn btn-primary" disabled={submitting || cart.items.length === 0}>
            {submitting ? 'Placing order…' : `Place Order — ${peso(cart.total)}`}
          </button>
        </form>
      </section>
    )
  }

  /* ---------- Catalog view ---------- */
  return (
    <section className="section page">
      <h2>Pharmacy</h2>
      <p className="section-sub">
        Order from a Life Saver <span className="badge badge-gamot">Gamot</span> partner pharmacy — PhilHealth
        members may avail of medicines at these branches.
      </p>

      {error && <p className="error-box">{error}</p>}

      <div className="filter-bar">
        <select value={branchId || ''} onChange={(e) => setBranchId(Number(e.target.value) || null)}>
          <option value="">Choose your pharmacy branch…</option>
          {pharmacies.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.city}
            </option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input type="search" placeholder="Search medicines…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="shop-layout">
        <div className="product-grid">
          {filtered.map((p) => (
            <div key={p.id} className="product-card">
              <h3>{p.name}</h3>
              {p.generic_name && <p className="muted">{p.generic_name}</p>}
              <p className="product-cat">{p.category}{p.requires_rx ? ' · ℞ prescription required' : ''}</p>
              <div className="product-foot">
                <span className="product-price">{peso(p.price)}</span>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => cart.add(p)}>
                  Add
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && !error && <p className="muted center">No medicines match.</p>}
        </div>

        <aside className="cart-panel">
          <h3>Your Order {cart.count > 0 && `(${cart.count})`}</h3>
          {cart.items.length === 0 && <p className="muted">Cart is empty — add medicines from the list.</p>}
          {cart.items.map((i) => (
            <div key={i.product_id} className="cart-row">
              <span>{i.name}</span>
              <span className="qty-controls">
                <button onClick={() => cart.setQty(i.product_id, i.qty - 1)}>−</button>
                {i.qty}
                <button onClick={() => cart.setQty(i.product_id, i.qty + 1)}>+</button>
              </span>
            </div>
          ))}
          {cart.items.length > 0 && (
            <>
              <div className="cart-row cart-total">
                <span>Total</span>
                <span>{peso(cart.total)}</span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={!branchId}
                onClick={() => setCheckingOut(true)}
              >
                {branchId ? 'Checkout' : 'Choose a branch first'}
              </button>
            </>
          )}
        </aside>
      </div>
    </section>
  )
}
