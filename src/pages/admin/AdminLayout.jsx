import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAdmin } from './AdminRoutes.jsx'
import {
  LayoutGridIcon,
  CalendarIcon,
  PillIcon,
  ClockIcon,
  GaugeIcon,
  SettingsIcon,
  BuildingIcon,
  LogOutIcon,
} from '../../components/Icons.jsx'

const PAGE_TITLES = {
  '/admin': 'Dashboard',
  '/admin/bookings': 'Bookings',
  '/admin/orders': 'Pharmacy Orders',
  '/admin/capacity': 'Capacity & Sessions',
  '/admin/schedule': 'Weekly Schedule',
  '/admin/settings': 'Branch Settings',
  '/admin/manage': 'Manage System',
}

function NavItem({ to, end = false, Icon, children }) {
  return (
    <NavLink to={to} end={end}>
      <Icon size={18} />
      <span>{children}</span>
    </NavLink>
  )
}

export default function AdminLayout() {
  const { admin, logout, isSuper } = useAdmin()
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] || 'Dashboard'
  const today = new Date().toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const initials = (admin.display_name || admin.username || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-brand">
          <img src="/box-type-logo.png" alt="" />
          <div>
            <strong>Life Saver</strong>
            <span>Ops Console</span>
          </div>
        </div>

        <p className="adm-nav-label">Operations</p>
        <nav className="adm-nav">
          <NavItem to="/admin" end Icon={LayoutGridIcon}>Dashboard</NavItem>
          <NavItem to="/admin/bookings" Icon={CalendarIcon}>Bookings</NavItem>
          <NavItem to="/admin/orders" Icon={PillIcon}>Orders</NavItem>
          <NavItem to="/admin/capacity" Icon={GaugeIcon}>Capacity</NavItem>
        </nav>

        <p className="adm-nav-label">Configuration</p>
        <nav className="adm-nav">
          {!isSuper && <NavItem to="/admin/schedule" Icon={ClockIcon}>Schedule</NavItem>}
          {!isSuper && <NavItem to="/admin/settings" Icon={SettingsIcon}>Branch Settings</NavItem>}
          {isSuper && <NavItem to="/admin/manage" Icon={BuildingIcon}>Manage System</NavItem>}
        </nav>

        <div className="adm-user">
          <span className="adm-avatar" aria-hidden="true">{initials}</span>
          <div className="adm-user-meta">
            <strong>{admin.display_name}</strong>
            <span>{isSuper ? 'Corporate admin' : 'Branch admin'}</span>
          </div>
          <button type="button" className="adm-logout" onClick={logout} aria-label="Sign out" title="Sign out">
            <LogOutIcon size={17} />
          </button>
        </div>
      </aside>

      <div className="adm-body">
        <header className="adm-topbar">
          <div>
            <h1 className="adm-title">{title}</h1>
            <p className="adm-date">{today}</p>
          </div>
          <span className="adm-branch-chip">
            <BuildingIcon size={14} />
            {isSuper ? 'All branches' : admin.branch_name}
          </span>
        </header>
        <main className="adm-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
