import { useEffect, useState } from 'react'
import { adminApi } from '../../api.js'

export default function Settings() {
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    adminApi.get('/branch-settings').then(setForm).catch((e) => setError(e.message))
  }, [])

  async function save(e) {
    e.preventDefault()
    setError('')
    setSaved(false)
    try {
      await adminApi.patch('/branch-settings', {
        address: form.address,
        phone: form.phone,
        gcash_number: form.gcash_number,
        qr_image_url: form.qr_image_url,
      })
      setSaved(true)
    } catch (err) {
      setError(err.message)
    }
  }

  if (!form) return error ? <p className="error-box">{error}</p> : <p className="muted">Loading…</p>

  return (
    <>
      <h2>Branch Settings</h2>
      <p className="muted">{form.name}</p>
      {error && <p className="error-box">{error}</p>}
      {saved && <p className="success-box">Settings saved</p>}

      <form className="form-card" onSubmit={save}>
        <label>
          Branch address
          <input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </label>
        <label>
          Branch phone
          <input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>

        <h3>Online Payment (GCash / QRPh)</h3>
        <p className="muted">
          Customers paying online will see this. Leave blank to disable online payment for your branch.
        </p>
        <label>
          GCash number
          <input
            placeholder="09XX XXX XXXX"
            value={form.gcash_number || ''}
            onChange={(e) => setForm({ ...form, gcash_number: e.target.value })}
          />
        </label>
        <label>
          QR code image URL
          <input
            placeholder="https://…  (link to your GCash/QRPh QR image)"
            value={form.qr_image_url || ''}
            onChange={(e) => setForm({ ...form, qr_image_url: e.target.value })}
          />
        </label>
        {form.qr_image_url && <img src={form.qr_image_url} alt="Payment QR preview" className="pay-qr" />}

        <button type="submit" className="btn btn-primary">Save Settings</button>
      </form>
    </>
  )
}
