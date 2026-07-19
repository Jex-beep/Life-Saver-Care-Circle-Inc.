import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { sortByDistance, resolvePlace, mapEmbedUrl, mapsLinkUrl } from '../data/geo.js'
import { MapPinIcon, PhoneIcon } from './Icons.jsx'

/**
 * Shared clinic/pharmacy finder with:
 *  - "Use my location" (browser geolocation) to sort branches by distance
 *  - text fallback: type a city / barangay / province
 *  - Google Maps embed of the selected branch
 * Props: branches, bookPath ('/book' | null), orderPath ('/pharmacy' | null)
 */
export default function BranchFinder({ branches, bookPath = null, orderPath = null }) {
  const [selected, setSelected] = useState(branches[0] || null)
  const [origin, setOrigin] = useState(null) // { lat, lng, label }
  const [placeText, setPlaceText] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const list = useMemo(() => {
    if (!origin) return branches.map((b) => ({ ...b, distanceKm: null }))
    return sortByDistance(branches, origin)
  }, [branches, origin])

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus('Your browser does not support location — please type your city below instead.')
      return
    }
    setBusy(true)
    setStatus('Finding your location…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'your location' }
        setOrigin(point)
        const nearest = sortByDistance(branches, point)[0]
        if (nearest) setSelected(nearest)
        setStatus('Showing branches nearest to you — closest first.')
        setBusy(false)
      },
      () => {
        setStatus('We could not get your location. You can type your city, barangay, or province below instead.')
        setBusy(false)
      },
      { timeout: 10000 }
    )
  }

  async function findByPlace(e) {
    e.preventDefault()
    if (!placeText.trim()) return
    setBusy(true)
    setStatus(`Searching for "${placeText}"…`)
    const point = await resolvePlace(placeText)
    if (!point) {
      setStatus('We could not find that place — try the city or province name, e.g. "Dasmarinas" or "Rizal".')
      setBusy(false)
      return
    }
    setOrigin(point)
    const nearest = sortByDistance(branches, point)[0]
    if (nearest) setSelected(nearest)
    setStatus('Showing branches nearest to that area — closest first.')
    setBusy(false)
  }

  return (
    <div className="finder">
      <div className="finder-list-col">
        <div className="finder-locate">
          <button type="button" className="btn btn-primary finder-locate-btn" onClick={useMyLocation} disabled={busy}>
            <MapPinIcon size={18} /> Use My Location
          </button>
          <form className="finder-place" onSubmit={findByPlace}>
            <input
              placeholder="Or type your city, barangay, or province…"
              value={placeText}
              onChange={(e) => setPlaceText(e.target.value)}
              aria-label="Type your city, barangay, or province"
            />
            <button type="submit" className="btn btn-secondary btn-sm" disabled={busy}>
              Find
            </button>
          </form>
        </div>
        {status && <p className="finder-status" role="status">{status}</p>}

        <div className="finder-list" role="listbox" aria-label="Branches">
          {list.map((b) => (
            <button
              key={b.id}
              type="button"
              role="option"
              aria-selected={selected?.id === b.id}
              className={`finder-item ${selected?.id === b.id ? 'is-selected' : ''}`}
              onClick={() => setSelected(b)}
            >
              <span className="finder-item-name">{b.name}</span>
              <span className="finder-item-loc">
                {b.city}, {b.province}
                {b.distanceKm != null && Number.isFinite(b.distanceKm) && (
                  <em> · about {b.distanceKm < 1 ? 'less than 1' : Math.round(b.distanceKm)} km away</em>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="finder-map-col">
        {selected ? (
          <>
            <div className="finder-map-head">
              <div>
                <h3>{selected.name}</h3>
                <p>
                  {selected.city}, {selected.province}
                  {selected.phone && (
                    <>
                      {' '}·{' '}
                      <a href={`tel:${selected.phone.replace(/\s/g, '')}`}>
                        <PhoneIcon size={14} className="inline-icon" /> {selected.phone}
                      </a>
                    </>
                  )}
                </p>
              </div>
              <div className="finder-map-actions">
                {bookPath && (
                  <Link to={`${bookPath}?branch=${selected.id}`} className="btn btn-primary btn-sm">
                    Book Here
                  </Link>
                )}
                {orderPath && (
                  <Link to={`${orderPath}?branch=${selected.id}`} className="btn btn-secondary btn-sm">
                    Order Here
                  </Link>
                )}
                <a href={mapsLinkUrl(selected)} target="_blank" rel="noopener noreferrer" className="finder-map-link">
                  Open in Google Maps
                </a>
              </div>
            </div>
            <iframe
              key={selected.id}
              title={`Map showing ${selected.name}`}
              src={mapEmbedUrl(selected)}
              className="finder-map"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </>
        ) : (
          <p className="muted center">Choose a branch to see it on the map.</p>
        )}
      </div>
    </div>
  )
}
