import { NavLink, Outlet } from 'react-router-dom'
import { useAdmin } from './AdminRoutes.jsx'

export default function AdminLayout() {
  const { admin, logout, isSuper } = useAdmin()

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <img src="/rectangle-type-logo.png" alt="Life Saver Care Circle Inc." className="admin-logo" />
        <p className="admin-branch">{isSuper ? 'Corporate Admin' : admin.branch_name}</p>
        <nav>
          <NavLink to="/admin" end>Dashboard</NavLink>
          <NavLink to="/admin/bookings">Bookings</NavLink>
          <NavLink to="/admin/orders">Orders</NavLink>
          {!isSuper && <NavLink to="/admin/schedule">Schedule</NavLink>}
          {!isSuper && <NavLink to="/admin/settings">Branch Settings</NavLink>}
          {isSuper && <NavLink to="/admin/manage">Manage System</NavLink>}
        </nav>
        <div className="admin-foot">
          <p className="muted">{admin.display_name}</p>
          <button type="button" className="link-btn" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
