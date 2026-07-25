import { useEffect, useState } from 'react'
import { STATIC_MODE } from '../config.js'
import { api } from '../api.js'
import { BRANCHES } from '../data/branches.js'
import Pager from '../components/Pager.jsx'
import FooterPage from '../components/FooterPage.jsx'
import BranchFinder from '../components/BranchFinder.jsx'

/* kept for the booking wizard's branch cards */
export function branchBadges(targetClient) {
  const badges = []
  if (targetClient.includes('Yakap'))
    badges.push({ label: 'Yakap', cls: 'badge-yakap', title: 'PhilHealth-accredited Primary Care Facility' })
  if (targetClient.includes('Gamot'))
    badges.push({ label: 'Gamot', cls: 'badge-gamot', title: 'PhilHealth members may avail of medicines here' })
  if (targetClient.includes('Drug Store'))
    badges.push({ label: 'Pharmacy', cls: 'badge-gamot', title: 'Stand-alone drug store' })
  return badges
}

/* Facility types for the Yakap Clinic dropdown. */
const FACILITY_TYPES = [
  {
    id: 'yakap',
    label: 'Yakap Clinics',
    blurb: 'PhilHealth-accredited Primary Care Clinics.',
    match: (b) => b.target_client.includes('Yakap'),
  },
  {
    id: 'pharmacy',
    label: 'Pharmacies',
    blurb: 'Gamot medicine partners and stand-alone drug stores.',
    match: (b) => b.target_client.includes('Gamot') || b.target_client.includes('Drug Store'),
  },
  {
    id: 'animalbite',
    label: 'AnimalBite Centers',
    blurb: 'Anti-rabies and animal-bite treatment centers.',
    match: (b) => b.target_client.includes('AnimalBite') || b.target_client.includes('Animal Bite'),
  },
]

function FinderPage({ branches, error }) {
  const [typeId, setTypeId] = useState('yakap')
  const type = FACILITY_TYPES.find((t) => t.id === typeId) || FACILITY_TYPES[0]
  const filtered = branches.filter(type.match)

  return (
    <div className="hp-section finder-section">
      <span className="section-eyebrow">Our network</span>
      <div className="finder-heading">
        <h2>{type.label}</h2>
        <label className="finder-type">
          <span className="finder-type-label">Show</span>
          <select
            className="finder-type-select"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            aria-label="Choose a facility type"
          >
            {FACILITY_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="section-sub">
        {type.blurb} Press <strong>Use My Location</strong> or type your area, and we'll show the one closest to you.
      </p>
      {error && <p className="error-box">{error}</p>}
      {!error && filtered.length > 0 && (
        <BranchFinder key={typeId} branches={filtered} bookPath={STATIC_MODE ? null : '/book'} />
      )}
      {!error && filtered.length === 0 && branches.length > 0 && (
        <p className="muted center finder-empty">
          No {type.label.toLowerCase()} listed yet — new locations are coming soon.
        </p>
      )}
      {!error && branches.length === 0 && <p className="muted center">Loading…</p>}
    </div>
  )
}

export default function Branches() {
  const [branches, setBranches] = useState(STATIC_MODE ? BRANCHES : [])
  const [error, setError] = useState('')

  useEffect(() => {
    if (STATIC_MODE) return
    api.get('/branches').then(setBranches).catch((e) => setError(e.message))
  }, [])

  const pages = [
    {
      id: 'clinics',
      label: 'Yakap Clinic',
      scroll: true,
      content: <FinderPage branches={branches} error={error} />,
    },
    { id: 'contact', label: 'Contact Us', content: <FooterPage />, scroll: true },
  ]

  return <Pager pages={pages} />
}
