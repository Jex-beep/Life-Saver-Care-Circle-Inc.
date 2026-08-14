import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, peso } from '../api.js'
import { useCart } from '../context/CartContext.jsx'
import { branchCoords, sortByDistance } from '../data/geo.js'
import { PillIcon } from '../components/Icons.jsx'
import Pager from '../components/Pager.jsx'
import FooterPage from '../components/FooterPage.jsx'
import BranchFinder from '../components/BranchFinder.jsx'
import useGridFit from '../hooks/useGridFit.js'

/* Cards shrink with the viewport before the grid gives up a column or row.
   The height is only a starting floor — useGridFit measures what the cards
   actually need once they are on screen. */
const CARD_MIN_W = { min: 175, vw: 0.15, max: 250 }
const CARD_MIN_H = { min: 165, vh: 0.22, max: 250 }

/**
 * Where else can someone get this medicine? Ranked by distance from the
 * branch they picked, so the suggestion is the closest realistic option
 * rather than an arbitrary branch across the country.
 */
function nearestAlternative(product, pharmacies, currentBranch) {
  if (!product.available_at?.length) return null
  const options = pharmacies.filter((p) => product.available_at.includes(p.id))
  if (options.length === 0) return null

  const from = currentBranch && branchCoords(currentBranch)
  if (!from) return options[0]

  const ranked = sortByDistance(options, from)
  return ranked[0] || options[0]
}

function StockLine({ product, pharmacies, branch, onSwitchBranch }) {
  if (product.stock === null) return null // no branch chosen yet

  if (product.stock > 0) {
    return product.stock <= 5 ? (
      <p className="stock-line stock-low">Only {product.stock} left here</p>
    ) : (
      <p className="stock-line stock-ok">{product.stock} in stock</p>
    )
  }

  const alt = nearestAlternative(product, pharmacies, branch)
  if (!alt) return <p className="stock-line stock-out">Out of stock at all branches</p>

  return (
    <p className="stock-line stock-out">
      Out of stock here —{' '}
      <button type="button" className="link-btn" onClick={() => onSwitchBranch(alt.id)}>
        available at {alt.name.replace(/^Life Saver (Medical Services|Pharmacy) - /, '')}
        {Number.isFinite(alt.distanceKm) && alt.distanceKm > 0 && `, ${Math.round(alt.distanceKm)} km away`}
      </button>
    </p>
  )
}

function Catalog({ pharmacies, products, error, branchId, setBranchId, onCheckout }) {
  const cart = useCart()
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  /* stackAt matches the Pager's own breakpoint — below it the page scrolls
     vertically instead of paging sideways, so there is nothing to fit to. */
  const [gridRef, grid] = useGridFit({
    minWidth: CARD_MIN_W,
    minHeight: CARD_MIN_H,
    gap: 14,
    stackAt: 860,
  })

  const branch = pharmacies.find((p) => p.id === branchId) || null
  const categories = useMemo(() => ['All', ...new Set(products.map((p) => p.category))], [products])
  const filtered = products.filter(
    (p) =>
      (category === 'All' || p.category === category) &&
      (search === '' || `${p.name} ${p.generic_name}`.toLowerCase().includes(search.toLowerCase()))
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / grid.perPage))
  /* A narrower window fits fewer cards, which can strand the reader past the
     last page — pull them back to the final one that still has medicines. */
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(safePage * grid.perPage, (safePage + 1) * grid.perPage)

  const pick = (setter) => (v) => {
    setter(v)
    setPage(0)
  }

  const switchBranch = (id) => {
    setBranchId(id)
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
        <div className="shop-main">
          <div className="product-grid hp-products" ref={gridRef} style={grid.style}>
            {pageItems.map((p) => {
              const outHere = branchId && p.stock === 0
              return (
                <div key={p.id} className={`product-card ${outHere ? 'is-out' : ''}`}>
                  <div className="product-top">
                    <span className="product-tile"><PillIcon size={20} /></span>
                    {p.requires_rx && <span className="rx-chip" title="Prescription required">Rx required</span>}
                  </div>
                  <h3>{p.name}</h3>
                  {p.generic_name && <p className="muted small">{p.generic_name}</p>}
                  <p className="product-cat">{p.category}</p>
                  <StockLine product={p} pharmacies={pharmacies} branch={branch} onSwitchBranch={switchBranch} />
                  <div className="product-foot">
                    <span className="product-price">{peso(p.price)}</span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={!branchId || p.stock === 0}
                      onClick={() => cart.add(p)}
                    >
                      {!branchId ? 'Pick a branch' : p.stock === 0 ? 'Out of stock' : 'Add'}
                    </button>
                  </div>
                </div>
              )
            })}
            {pageItems.length === 0 && !error && <p className="muted center">No medicines match your search.</p>}
          </div>

          {pageCount > 1 && (
            <div className="shop-pagination">
              <button type="button" className="btn btn-secondary btn-sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                ‹ Previous
              </button>
              <span className="shop-pagination-label">
                Page {safePage + 1} of {pageCount} · {filtered.length} medicines
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
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
  const cart = useCart()
  const [pharmacies, setPharmacies] = useState([])
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')
  const [branchId, setBranchId] = useState(params.get('branch') ? Number(params.get('branch')) : null)
  const [view, setView] = useState('catalog') // catalog | checkout | done
  const [result, setResult] = useState(null)

  useEffect(() => {
    api.get('/pharmacies').then(setPharmacies).catch((e) => setError(e.message))
  }, [])

  /* Stock is per branch, so the catalog is refetched whenever the shopper
     switches branches — including when they follow an out-of-stock referral. */
  useEffect(() => {
    const query = branchId ? `?branch_id=${branchId}` : ''
    api.get(`/products${query}`).then(setProducts).catch((e) => setError(e.message))
  }, [branchId])

  /* A cart built at one branch can't be fulfilled at another. */
  const changeBranch = (id) => {
    if (id !== branchId) cart.clear()
    setBranchId(id)
  }

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
        setBranchId={changeBranch}
        onCheckout={() => setView('checkout')}
      />
    )
  }

  const pages = [
    /* No `scroll` — the catalog fits itself to the viewport (see useGridFit).
       Checkout and the confirmation are short forms that still need to scroll
       on a laptop, so they keep it. */
    { id: 'shop', label: 'Order Medicines', scroll: view !== 'catalog', content: shopContent },
    {
      id: 'locations',
      label: 'Pharmacy Locations',
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
    { id: 'contact', label: 'Contact Us', content: <FooterPage />, scroll: true },
  ]

  return <Pager pages={pages} />
}
