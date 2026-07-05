import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { CartIcon } from './Icons.jsx'

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Branches', to: '/branches' },
  { label: 'Pharmacy', to: '/pharmacy' },
  { label: 'Track', to: '/track' },
  { label: 'Contact', to: '/#contact' },
]

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const cart = useCart()

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
          <img src="/box-type-logo.png" alt="" className="brand-logo" />
          <span className="brand-text">
            <span className="brand-name">Life Saver</span>
            <span className="brand-sub">Care Circle Inc.</span>
          </span>
        </Link>

        <button
          type="button"
          className="menu-toggle"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <nav className={`nav-links ${menuOpen ? 'open' : ''}`}>
          {NAV_LINKS.map((link) =>
            link.to.includes('#') ? (
              <Link key={link.label} to={link.to} onClick={() => setMenuOpen(false)}>
                {link.label}
              </Link>
            ) : (
              <NavLink
                key={link.label}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </NavLink>
            )
          )}
          {cart?.count > 0 && (
            <Link to="/pharmacy" className="cart-pill" onClick={() => setMenuOpen(false)}>
              <CartIcon size={16} /> {cart.count}
            </Link>
          )}
          <Link to="/book" className="nav-cta" onClick={() => setMenuOpen(false)}>
            Book Now
          </Link>
        </nav>
      </div>
    </header>
  )
}
