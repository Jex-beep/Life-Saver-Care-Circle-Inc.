/**
 * Branch geography: approximate city-center coordinates for every city
 * with a Life Saver branch, place aliases for the text-input fallback,
 * distance math, and Google Maps embed URLs (keyless iframe embeds).
 */

export const CITY_COORDS = {
  'Quezon City': { lat: 14.676, lng: 121.0437 },
  'San Juan': { lat: 14.6019, lng: 121.0355 },
  'Taguig': { lat: 14.5176, lng: 121.0509 },
  'Taytay': { lat: 14.5573, lng: 121.1324 },
  'Tanza': { lat: 14.3944, lng: 120.8531 },
  'Gen. Trias': { lat: 14.3869, lng: 120.8816 },
  'Dasmarinas': { lat: 14.3294, lng: 120.9367 },
  'San Jose/Tanauan': { lat: 14.0863, lng: 121.1497 },
  'New Lucena': { lat: 10.8817, lng: 122.6062 },
}

/* Common places people may type, mapped to coordinates (lowercased keys).
   Covers provinces and nearby cities around the branch network. */
const PLACE_GAZETTEER = {
  'quezon city': CITY_COORDS['Quezon City'],
  qc: CITY_COORDS['Quezon City'],
  novaliches: { lat: 14.7247, lng: 121.0281 },
  zabarte: { lat: 14.7362, lng: 121.0308 },
  fairview: { lat: 14.7333, lng: 121.0667 },
  manila: { lat: 14.5995, lng: 120.9842 },
  makati: { lat: 14.5547, lng: 121.0244 },
  pasig: { lat: 14.5764, lng: 121.0851 },
  marikina: { lat: 14.6507, lng: 121.1029 },
  caloocan: { lat: 14.6507, lng: 120.9672 },
  valenzuela: { lat: 14.7011, lng: 120.983 },
  'san juan': CITY_COORDS['San Juan'],
  mandaluyong: { lat: 14.5794, lng: 121.0359 },
  taguig: CITY_COORDS['Taguig'],
  bgc: CITY_COORDS['Taguig'],
  pateros: { lat: 14.5454, lng: 121.0687 },
  paranaque: { lat: 14.4793, lng: 121.0198 },
  'las pinas': { lat: 14.4445, lng: 120.9939 },
  muntinlupa: { lat: 14.4081, lng: 121.0415 },
  rizal: CITY_COORDS['Taytay'],
  taytay: CITY_COORDS['Taytay'],
  antipolo: { lat: 14.5878, lng: 121.176 },
  cainta: { lat: 14.5786, lng: 121.1222 },
  angono: { lat: 14.5266, lng: 121.1536 },
  cavite: CITY_COORDS['Dasmarinas'],
  dasmarinas: CITY_COORDS['Dasmarinas'],
  dasma: CITY_COORDS['Dasmarinas'],
  imus: { lat: 14.4297, lng: 120.9367 },
  bacoor: { lat: 14.4624, lng: 120.9645 },
  tanza: CITY_COORDS['Tanza'],
  'general trias': CITY_COORDS['Gen. Trias'],
  'gen trias': CITY_COORDS['Gen. Trias'],
  'gen. trias': CITY_COORDS['Gen. Trias'],
  kawit: { lat: 14.4443, lng: 120.9028 },
  batangas: CITY_COORDS['San Jose/Tanauan'],
  tanauan: CITY_COORDS['San Jose/Tanauan'],
  'san jose': CITY_COORDS['San Jose/Tanauan'],
  lipa: { lat: 13.9411, lng: 121.1622 },
  'sto tomas': { lat: 14.1078, lng: 121.1414 },
  laguna: { lat: 14.2691, lng: 121.4113 },
  calamba: { lat: 14.2117, lng: 121.1653 },
  iloilo: { lat: 10.7202, lng: 122.5621 },
  'iloilo city': { lat: 10.7202, lng: 122.5621 },
  'new lucena': CITY_COORDS['New Lucena'],
  'santa barbara': { lat: 10.8231, lng: 122.5344 },
}

export function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

export function branchCoords(branch) {
  return CITY_COORDS[branch.city] || null
}

/* Sort branches by distance from a point; returns [{...branch, distanceKm}] */
export function sortByDistance(branches, point) {
  return branches
    .map((b) => {
      const c = branchCoords(b)
      return { ...b, distanceKm: c ? haversineKm(point, c) : Infinity }
    })
    .sort((x, y) => x.distanceKm - y.distanceKm)
}

/* Resolve typed place text to coordinates: local gazetteer first,
   then OpenStreetMap's free Nominatim geocoder (Philippines only). */
export async function resolvePlace(text) {
  const key = text.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!key) return null
  for (const [name, coords] of Object.entries(PLACE_GAZETTEER)) {
    if (key === name || key.includes(name)) return { ...coords, label: name }
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ph&limit=1&q=${encodeURIComponent(text)}`,
      { headers: { Accept: 'application/json' } }
    )
    const data = await res.json()
    if (data[0]) return { lat: Number(data[0].lat), lng: Number(data[0].lon), label: data[0].display_name }
  } catch {
    /* offline or rate-limited — caller shows a friendly message */
  }
  return null
}

/* Keyless Google Maps iframe embed centered on the branch */
export function mapEmbedUrl(branch) {
  const q = `${branch.name}, ${branch.city}, ${branch.province}, Philippines`
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`
}

export function mapsLinkUrl(branch) {
  const q = `${branch.name}, ${branch.city}, ${branch.province}, Philippines`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}
