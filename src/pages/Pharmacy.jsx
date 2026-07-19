import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, peso } from '../api.js'
import { useCart } from '../context/CartContext.jsx'
import { PillIcon } from '../components/Icons.jsx'
import Pager from '../components/Pager.jsx'
import FooterPage from '../components/FooterPage.jsx'
import BranchFinder from '../components/BranchFinder.jsx'

const PER_PAGE = 8

function Catalog({ pharmacies, products, error, branchId, setBranchId, onCheckout }) {
  const cart = useCart()
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const categories = useMemo(() => ['All', ...new Set(products.map((p) => p.category))], [products])
  const filtered = products.filter(
    (p) =>
      (category === 'All' || p.category === category) &&
      (search === '' || `${p.name} ${p.generic_name}`.toLowerCase().includes(search.toLowerCase()))
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const pageItems = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  const pick = (setter) => (v) => {
    setter(v)
    setPage(0)
  }

  return (
    <div className="hp-section shop-page">
      <span className="section-eyebrow">Online pharmacy</span>
      <h2>Order Medicines</h2>

      {error && <p className="error-box">{error}</p>}

      <div className="shop-controls">
        <select
          className="shop-branch-select"
          value={branchId || ''}
          onChange={(e) => setBranchId(Number(e.target.value) || null)}
          aria-label="Choose your pharmacy branch"
        >
          <option value="">Choose your pharmacy branch…</option>
          {pharmacies.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.city}
            </option>
          ))}
        </select>
        <input
          type="search"
          className="shop-search"
          placeholder="Search medicine or generic name…"
          value={search}
          onChange={(e) => pick(setSearch)(e.target.value)}
        />
      </div>

      <div className="shop-cats" role="tablist" aria-label="Medicine categories">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            className={`shop-cat ${category === c ? 'active' : ''}`}
            onClick={() => pick(setCategory)(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="shop-layout">
        <div>
          <div className="product-grid hp-products">
            {pageItems.map((p) => (
              <div key={p.id} className="product-card">
                <div className="product-top">
                  <span className="product-tile"><PillIcon size={20} /></span>
                  {p.requires_rx && <span className="rx-chip" title="Prescription required">Rx required</span>}
                </div>
                <h3>{p.name}</h3>
                {p.generic_name && <p className="muted small">{p.generic_name}</p>}
                <p className="product-cat">{p.category}</p>
                <div className="product-foot">
                  <span className="product-price">{peso(p.price)}</span>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => cart.add(p)}>
                    Add
                  </button>
                </div>
              </div>
            ))}
            {pageItems.length === 0 && !error && <p className="muted center">No medicines match your search.</p>}
          </div>

          {pageCount > 1 && (
            <div className="shop-pagination">
              <button type="button" className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                ‹ Previous
              </button>
              <span className="shop-pagination-label">
                Page {page + 1} of {pageCount} · {filtered.length} medicines
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page >= pageCount - 1}
                onClick={() => setPage(page + 1)}
              >
                More medicines ›
              </button>
            </div>
          )}
        </div>

        <aside className="cart-panel">
          <h3>Your Order {cart.count > 0 && `(${cart.count})`}</h3>
          {cart.items.length === 0 && <p className="muted">Cart is empty — press "Add" on a medicine.</p>}
          {cart.items.map((i) => (
            <div key={i.product_id} className="cart-row">
              <span>{i.name}</span>
              <span className="qty-controls">
                <button onClick={() => cart.setQty(i.product_id, i.qty - 1)} aria-label={`Remove one ${i.name}`}>−</button>
                {i.qty}
                <button onClick={() => cart.setQty(i.product_id, i.qty + 1)} aria-label={`Add one ${i.name}`}>+</button>
              </span>
            </div>
          ))}
          {cart.items.length > 0 && (
            <>
              <div className="cart-row cart-total">
                <span>Total</span>
                <span>{peso(cart.total)}</span>
              </div>
              <button type="button" className="btn btn-primary" style={{ width: '100%' }} disabled={!branchId} onClick={onCheckout}>
                {branchId ? 'Checkout' : 'Choose a branch first'}
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

function Checkout({ branch, onBack, onDone }) {
  const cart = useCart()
  const [form, setForm] = useState({ customer_name: '', phone: '', email: '', philhealth_no: '', notes: '' })
  const [paymentMethod, setPaymentMethod] = useState('onsite')
  const [paymentRef, setPaymentRef] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const onlineAvailable = branch && (branch.qr_image_url || branch.gcash_number)

  async function submitOrder(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const result = await api.post('/orders', {
        branch_id: branch.id,
        items: cart.items,
        payment_method: paymentMethod,
        payment_ref: paymentRef,
        ...form,
      })
      cart.clear()
      onDone(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="hp-section page-narrow">
      <span className="section-eyebrow">Online pharmacy</span>
      <h2>Checkout</h2>
      <p className="picked">
        Pharmacy: <strong>{branch?.name}</strong>{' '}
        <button className="link-btn" onClick={onBack}>back to catalog</button>
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
            <input type="radio" name="pay" checked={paymentMethod === 'onsite'} onChange={() => setPaymentMethod('onsite')} />
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
              {branch.qr_image_url && <img src={branch.qr_image_url} alt="Branch payment QR code" className="pay-qr" />}
              {branch.gcash_number && <p>GCash: <strong>{branch.gcash_number}</strong></p>}
              <p className="muted">Scan / send your payment, then enter the reference number from your e-wallet receipt:</p>
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
    </div>
  )
}

function Confirmation({ result, branch, onNewOrder }) {
  return (
    <div className="hp-section">
      <div className="confirm-card">
        <PillIcon size={52} className="confirm-icon" />
        <h2>Order Placed!</h2>
        <p>Your reference number:</p>
        <p className="reference">{result.reference}</p>
        <div className="confirm-details">
          <p><strong>{branch?.name}</strong></p>
          <p>Total: <strong>{peso(result.total)}</strong></p>
          <p>
            {result.payment_method === 'online'
              ? result.payment_status === 'for_verification'
                ? 'The branch will verify your payment and prepare your order.'
                : 'Send your payment to the branch account, then track your order.'
              : 'Pay at the branch when you pick up your order.'}
          </p>
        </div>
        <div className="hero-actions" style={{ justifyContent: 'center' }}>
          <Link to="/track" className="btn btn-primary">Track this Order</Link>
          <button type="button" className="btn btn-secondary" onClick={onNewOrder}>New Order</button>
        </div>
      </div>
    </div>
  )
}

export default function Pharmacy() {
  const [params] = useSearchParams()
  const [pharmacies, setPharmacies] = useState([])
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')
  const [branchId, setBranchId] = useState(params.get('branch') ? Number(params.get('branch')) : null)
  const [view, setView] = useState('catalog') // catalog | checkout | done
  const [result, setResult] = useState(null)

  useEffect(() => {
    Promise.all([api.get('/pharmacies'), api.get('/products')])
      .then(([ph, pr]) => {
        setPharmacies(ph)
        setProducts(pr)
      })
      .catch((e) => setError(e.message))
  }, [])

  const branch = useMemo(() => pharmacies.find((p) => p.id === branchId), [pharmacies, branchId])

  let shopContent
  if (view === 'done' && result) {
    shopContent = <Confirmation result={result} branch={branch} onNewOrder={() => { setResult(null); setView('catalog') }} />
  } else if (view === 'checkout') {
    shopContent = (
      <Checkout
        branch={branch}
        onBack={() => setView('catalog')}
        onDone={(r) => { setResult(r); setView('done') }}
      />
    )
  } else {
    shopContent = (
      <Catalog
        pharmacies={pharmacies}
        products={products}
        error={error}
        branchId={branchId}
        setBranchId={setBranchId}
        onCheckout={() => setView('checkout')}
      />
    )
  }

  const pages = [
    { id: 'shop', label: 'Order Medicines', scroll: true, content: shopContent },
    {
      id: 'locations',
      label: 'Pharmacy Locations',
      scroll: true,
      content: (
        <div className="hp-section finder-section">
          <span className="section-eyebrow">Where to find us</span>
          <h2>Pharmacy Locations</h2>
          <p className="section-sub">
            Gamot partner pharmacies where PhilHealth members may avail of medicines. Find the closest one to you.
          </p>
          {pharmacies.length > 0 && <BranchFinder branches={pharmacies} orderPath="/pharmacy" />}
        </div>
      ),
    },
    { id: 'contact', label: 'Contact Us', content: <FooterPage /> },
  ]

  return <Pager pages={pages} />
}
