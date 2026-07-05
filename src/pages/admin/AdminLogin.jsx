import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdmin } from './AdminRoutes.jsx'

export default function AdminLogin() {
  const { login } = useAdmin()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(username, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login-wrap">
      <form className="admin-login" onSubmit={submit}>
        <img src="/rectangle-type-logo.png" alt="Life Saver Care Circle Inc." className="admin-logo center-logo" />
        <h2>Branch Login</h2>
        {error && <p className="error-box">{error}</p>}
        <label>
          Username
          <input required autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label>
          Password
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
        <p className="muted center">
          <Link to="/">← Back to website</Link>
        </p>
      </form>
    </div>
  )
}
