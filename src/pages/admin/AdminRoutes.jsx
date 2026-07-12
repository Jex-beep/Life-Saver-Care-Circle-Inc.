import { createContext, useContext, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { adminApi, getAdminSession, setAdminSession } from '../../api.js'
import AdminLogin from './AdminLogin.jsx'
import AdminLayout from './AdminLayout.jsx'
import Dashboard from './Dashboard.jsx'
import AdminBookings from './AdminBookings.jsx'
import AdminOrders from './AdminOrders.jsx'
import Capacity from './Capacity.jsx'
import Announcements from './Announcements.jsx'
import Schedule from './Schedule.jsx'
import Settings from './Settings.jsx'
import Manage from './Manage.jsx'
import '../../admin.css'

const AdminContext = createContext(null)
export const useAdmin = () => useContext(AdminContext)

export default function AdminRoutes() {
  const [session, setSession] = useState(getAdminSession())

  const login = async (username, password) => {
    const data = await adminApi.login(username, password)
    setAdminSession(data)
    setSession(data)
  }

  const logout = () => {
    setAdminSession(null)
    setSession(null)
  }

  const value = { session, admin: session?.admin, login, logout, isSuper: session?.admin?.role === 'super' }

  return (
    <AdminContext.Provider value={value}>
      {!session ? (
        <AdminLogin />
      ) : (
        <Routes>
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="capacity" element={<Capacity />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="settings" element={<Settings />} />
            <Route path="announcements" element={value.isSuper ? <Announcements /> : <Navigate to="/admin" replace />} />
            <Route path="manage" element={value.isSuper ? <Manage /> : <Navigate to="/admin" replace />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      )}
    </AdminContext.Provider>
  )
}
