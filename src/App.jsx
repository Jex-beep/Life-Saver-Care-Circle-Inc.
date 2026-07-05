import { Routes, Route, Outlet } from 'react-router-dom'
import { CartProvider } from './context/CartContext.jsx'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import Home from './pages/Home.jsx'
import Branches from './pages/Branches.jsx'
import Book from './pages/Book.jsx'
import Pharmacy from './pages/Pharmacy.jsx'
import Track from './pages/Track.jsx'
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

function App() {
  return (
    <CartProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/branches" element={<Branches />} />
          <Route path="/book" element={<Book />} />
          <Route path="/pharmacy" element={<Pharmacy />} />
          <Route path="/track" element={<Track />} />
        </Route>
        <Route path="/admin/*" element={<AdminRoutes />} />
      </Routes>
    </CartProvider>
  )
}

export default App
