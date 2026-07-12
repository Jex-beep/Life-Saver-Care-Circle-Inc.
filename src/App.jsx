import { Routes, Route, Outlet, Navigate } from 'react-router-dom'
import { STATIC_MODE } from './config.js'
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

function PublicLayout() {
  return (
    <>
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
