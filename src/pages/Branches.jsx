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

export default function Branches() {
  const [branches, setBranches] = useState(STATIC_MODE ? BRANCHES : [])
  const [error, setError] = useState('')

  useEffect(() => {
    if (STATIC_MODE) return
    api.get('/branches').then(setBranches).catch((e) => setError(e.message))
  }, [])

  const yakap = branches.filter((b) => b.target_client.includes('Yakap'))

  const pages = [
    {
      id: 'clinics',
      label: 'Yakap Clinics',
      scroll: true,
      content: (
        <div className="hp-section finder-section">
          <span className="section-eyebrow">Our network</span>
          <h2>Yakap Clinics</h2>
          <p className="section-sub">
            PhilHealth-accredited Primary Care Clinics. Press <strong>Use My Location</strong> or type your area,
            and we'll show the clinic closest to you.
          </p>
          {error && <p className="error-box">{error}</p>}
          {yakap.length > 0 && (
            <BranchFinder branches={yakap} bookPath={STATIC_MODE ? null : '/book'} />
          )}
          {!error && yakap.length === 0 && <p className="muted center">Loading clinics…</p>}
        </div>
      ),
    },
    { id: 'contact', label: 'Contact Us', content: <FooterPage /> },
  ]

  return <Pager pages={pages} />
}
