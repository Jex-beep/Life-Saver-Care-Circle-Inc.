import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { MapPinIcon, PhoneIcon } from '../components/Icons.jsx'
import PageHeader from '../components/PageHeader.jsx'

export function branchBadges(targetClient) {
  const badges = []
  if (targetClient.includes('Yakap')) badges.push({ label: 'Yakap', cls: 'badge-yakap', title: 'PhilHealth-accredited Primary Care Facility' })
  if (targetClient.includes('Gamot')) badges.push({ label: 'Gamot', cls: 'badge-gamot', title: 'PhilHealth members may avail of medicines here' })
  if (targetClient.includes('Drug Store')) badges.push({ label: 'Pharmacy', cls: 'badge-gamot', title: 'Stand-alone drug store' })
  return badges
}

export default function Branches() {
  const [branches, setBranches] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [area, setArea] = useState('All')
  const [province, setProvince] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    api
      .get('/branches')
      .then(setBranches)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const areas = useMemo(() => ['All', ...new Set(branches.map((b) => b.area))], [branches])
  const provinces = useMemo(
    () => ['All', ...new Set(branches.filter((b) => area === 'All' || b.area === area).map((b) => b.province))],
    [branches, area]
  )

  const filtered = branches.filter(
    (b) =>
      (area === 'All' || b.area === area) &&
      (province === 'All' || b.province === province) &&
      (search === '' || `${b.name} ${b.city}`.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <>
      <PageHeader eyebrow="Our network" title="Find a Branch">
        Find your nearest Life Saver clinic or pharmacy.{' '}
        <span className="badge badge-yakap">Yakap</span> PhilHealth-accredited Primary Care ·{' '}
        <span className="badge badge-gamot">Gamot</span> PhilHealth medicine partner
      </PageHeader>
    <section className="section page section-tight">
      <div className="filter-card">
        <label className="filter-field">
          <span>Area</span>
          <select value={area} onChange={(e) => { setArea(e.target.value); setProvince('All') }}>
            {areas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Province</span>
          <select value={province} onChange={(e) => setProvince(e.target.value)}>
            {provinces.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="filter-field grow">
          <span>Search</span>
          <input
            type="search"
            placeholder="Branch name or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {!loading && !error && (
        <p className="result-count">
          Showing <strong>{filtered.length}</strong> of {branches.length} branches
        </p>
      )}
      {loading && <p className="muted center">Loading branches…</p>}
      {error && <p className="error-box">{error}</p>}

      <div className="branch-grid">
        {filtered.map((b) => (
          <div key={b.id} className="branch-card">
            <div className="branch-badges">
              {branchBadges(b.target_client).map((badge) => (
                <span key={badge.label} className={`badge ${badge.cls}`} title={badge.title}>
                  {badge.label}
                </span>
              ))}
            </div>
            <h3>{b.name}</h3>
            <p className="branch-loc">
              <MapPinIcon size={14} className="inline-icon" /> {b.city}, {b.province} · {b.area}
            </p>
            {b.address && <p className="branch-addr">{b.address}</p>}
            {b.phone && (
              <p className="branch-addr">
                <PhoneIcon size={14} className="inline-icon" /> {b.phone}
              </p>
            )}
            <div className="branch-actions">
              {!b.target_client.includes('Drug Store') && (
                <Link to={`/book?branch=${b.id}`} className="btn btn-primary btn-sm">
                  Book Here
                </Link>
              )}
              {(b.target_client.includes('Gamot') || b.target_client.includes('Drug Store')) && (
                <Link to={`/pharmacy?branch=${b.id}`} className="btn btn-secondary btn-sm">
                  Order Medicines
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
      {!loading && !error && filtered.length === 0 && (
        <p className="muted center">No branches match those filters.</p>
      )}
    </section>
    </>
  )
}
