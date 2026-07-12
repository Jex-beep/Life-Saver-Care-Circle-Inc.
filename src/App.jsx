import { useEffect, useState } from 'react'
import { Routes, Route, Outlet, Navigate, Link } from 'react-router-dom'
import { STATIC_MODE } from './config.js'
import { api } from './api.js'
import { CartProvider } from './context/CartContext.jsx'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import Home from './pages/Home.jsx'
import About from './pages/About.jsx'
import Branches from './pages/Branches.jsx'
import Book from './pages/Book.jsx'
import Pharmacy from './pages/Pharmacy.jsx'
import Track from './pages/Track.jsx'
import BranchesStatic from './pages/static/BranchesStatic.jsx'
import PharmacyStatic from './pages/static/PharmacyStatic.jsx'
import AdminRoutes from './pages/admin/AdminRoutes.jsx'
import './App.css'
import './pages.css'

/* Site-wide bar for the announcement the superadmin pinned (one at a time) */
function AnnouncementBar() {
  const [pinned, setPinned] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (STATIC_MODE) return
    api
      .get('/announcements?pinned=1&limit=1')
      .then((items) => setPinned(items[0] || null))
      .catch(() => {})
  }, [])

  if (!pinned || dismissed || sessionStorage.getItem(`ls-ann-${pinned.id}`)) return null

  const dismiss = () => {
    sessionStorage.setItem(`ls-ann-${pinned.id}`, '1')
    setDismissed(true)
  }

  return (
    <div className="ann-bar" role="status">
      <Link to="/#news" className="ann-bar-text">
        <strong>{pinned.category === 'hiring' ? "We're hiring" : 'Announcement'}:</strong> {pinned.title}
      </Link>
      <button type="button" className="ann-bar-close" onClick={dismiss} aria-label="Dismiss announcement">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function PublicLayout() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}

/* Pre-approval informational site: no bookings, ordering, tracking, or admin.
   Flip STATIC_MODE in src/config.js to restore the full system. */
function StaticApp() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/branches" element={<BranchesStatic />} />
        <Route path="/pharmacy" element={<PharmacyStatic />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function FullApp() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/branches" element={<Branches />} />
        <Route path="/book" element={<Book />} />
        <Route path="/pharmacy" element={<Pharmacy />} />
        <Route path="/track" element={<Track />} />
      </Route>
      <Route path="/admin/*" element={<AdminRoutes />} />
    </Routes>
  )
}

function App() {
  return <CartProvider>{STATIC_MODE ? <StaticApp /> : <FullApp />}</CartProvider>
}

export default App
