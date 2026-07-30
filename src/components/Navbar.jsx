import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { STATIC_MODE } from '../config.js'
import { useCart } from '../context/CartContext.jsx'
import {
  CartIcon,
  HomeIcon,
  InfoIcon,
  HeartPulseIcon,
  PillIcon,
  SearchIcon,
  CalendarIcon,
  MapPinIcon,
} from './Icons.jsx'

const NAV_LINKS = STATIC_MODE
  ? [
      { label: 'Home', to: '/', Icon: HomeIcon },
      { label: 'About', to: '/about', Icon: InfoIcon },
      { label: 'Yakap', to: '/branches', cls: 'nav-yakap', Icon: HeartPulseIcon, hint: 'Primary care clinics' },
      { label: 'Gamot', to: '/pharmacy', cls: 'nav-gamot', Icon: PillIcon, hint: 'Partner pharmacies' },
    ]
  : [
      { label: 'Home', to: '/', Icon: HomeIcon },
      { label: 'About', to: '/about', Icon: InfoIcon },
      { label: 'Yakap', to: '/branches', cls: 'nav-yakap', Icon: HeartPulseIcon, hint: 'Primary care clinics' },
      { label: 'Gamot', to: '/pharmacy', cls: 'nav-gamot', Icon: PillIcon, hint: 'Partner pharmacies' },
      { label: 'Track', to: '/track', Icon: SearchIcon, hint: 'Check a reference number' },
    ]

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const cart = useCart()
  const location = useLocation()

  const close = () => setMenuOpen(false)

  /* Close on route change */
  useEffect(close, [location.pathname])

  /* Lock body scroll + close on Escape while the drawer is open */
  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const cta = STATIC_MODE
    ? { to: '/branches', label: 'Find a Clinic', Icon: MapPinIcon }
    : { to: '/book', label: 'Book Now', Icon: CalendarIcon }

  return (
    <>
      <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand" onClick={close}>
          <img src="/LS_LOGO.png" alt="" className="brand-logo" />
          <span className="brand-name">Life Saver</span>
        </Link>

        <button
          type="button"
          className={`menu-toggle ${menuOpen ? 'is-open' : ''}`}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="menu-bars" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="menu-toggle-text">{menuOpen ? 'Close' : 'Menu'}</span>
        </button>

        {/* Desktop navigation */}
        <nav className="nav-links">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.label}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) => [link.cls, isActive ? 'active' : ''].filter(Boolean).join(' ')}
            >
              {link.label}
            </NavLink>
          ))}
          {!STATIC_MODE && cart?.count > 0 && (
            <Link to="/pharmacy" className="cart-pill">
              <CartIcon size={16} /> {cart.count}
            </Link>
          )}
          <Link to={cta.to} className="nav-cta">
            {cta.label}
          </Link>
        </nav>
      </div>
      </header>

      {/* Mobile drawer — must live OUTSIDE <header>: the navbar's
          backdrop-filter would otherwise become the containing block for
          these position:fixed elements and trap them inside the bar. */}
      <div
        className={`mnav-backdrop ${menuOpen ? 'is-open' : ''}`}
        onClick={close}
        aria-hidden="true"
      />
      <nav id="mobile-menu" className={`mnav ${menuOpen ? 'is-open' : ''}`} aria-label="Main menu">
        <p className="mnav-title">Where would you like to go?</p>
        <ul className="mnav-list">
          {NAV_LINKS.map((link, i) => (
            <li key={link.label} style={{ '--i': i }}>
              <NavLink
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) => `mnav-item ${isActive ? 'active' : ''}`}
                onClick={close}
              >
                <span className={`mnav-icon ${link.cls || ''}`}>
                  <link.Icon size={24} />
                </span>
                <span className="mnav-text">
                  <strong>{link.label}</strong>
                  {link.hint && <em>{link.hint}</em>}
                </span>
                <svg className="mnav-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </NavLink>
            </li>
          ))}
          {!STATIC_MODE && cart?.count > 0 && (
            <li style={{ '--i': NAV_LINKS.length }}>
              <Link to="/pharmacy" className="mnav-item" onClick={close}>
                <span className="mnav-icon"><CartIcon size={24} /></span>
                <span className="mnav-text">
                  <strong>My Order</strong>
                  <em>{cart.count} item{cart.count > 1 ? 's' : ''} in cart</em>
                </span>
              </Link>
            </li>
          )}
        </ul>
        <Link to={cta.to} className="mnav-cta" onClick={close} style={{ '--i': NAV_LINKS.length + 1 }}>
          <cta.Icon size={22} /> {cta.label}
        </Link>
        <a href="tel:+639325688028" className="mnav-call" style={{ '--i': NAV_LINKS.length + 2 }}>
          Need help? Call 0932 568 8028
        </a>
      </nav>
    </>
  )
}
