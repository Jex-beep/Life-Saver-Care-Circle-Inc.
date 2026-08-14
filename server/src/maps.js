/**
 * Google Maps embed parsing.
 *
 * The superadmin adds a branch by pasting the HTML from Google Maps
 * ("Share > Embed a map > Copy HTML"). That paste is untrusted input that
 * ends up on the public site, so we never store or render the HTML itself —
 * we pull out two things and throw the rest away:
 *
 *   1. the iframe src URL, checked to be a real Google Maps embed, so the
 *      branch page can show the map
 *   2. the latitude/longitude, so "find the nearest Yakap" measures real
 *      distance instead of guessing from the city name
 *
 * Rendering the pasted HTML directly would be a stored-XSS hole: anything
 * with rights to add a branch could inject a <script> onto every visitor's
 * page. Extracting a validated URL closes that off.
 */

const ALLOWED_HOSTS = new Set([
  'www.google.com',
  'google.com',
  'maps.google.com',
  'www.google.com.ph',
  'google.com.ph',
])

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

/* Pull the src="..." out of an <iframe>, or accept a bare URL paste. */
function extractSrc(input) {
  const text = input.trim()
  const iframeSrc = text.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i)
  if (iframeSrc) return decodeEntities(iframeSrc[1]).trim()
  if (/^https?:\/\//i.test(text)) return decodeEntities(text.split(/\s/)[0])
  return null
}

/**
 * Coordinates live in the `pb` parameter of an embed URL as
 * `!1d<span>!2d<longitude>!3d<latitude>`. Plain map links instead use
 * `@<lat>,<lng>` or `!3d<lat>!4d<lng>`, so try those too.
 */
function extractCoords(url) {
  const pb = url.match(/!2d(-?\d+\.?\d*)!3d(-?\d+\.?\d*)/)
  if (pb) return { longitude: Number(pb[1]), latitude: Number(pb[2]) }

  const place = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/)
  if (place) return { latitude: Number(place[1]), longitude: Number(place[2]) }

  const at = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (at) return { latitude: Number(at[1]), longitude: Number(at[2]) }

  return { latitude: null, longitude: null }
}

/* Philippines only — a coordinate outside this box means we parsed the wrong number. */
function inPhilippines(lat, lng) {
  return lat >= 4 && lat <= 21 && lng >= 116 && lng <= 127
}

/**
 * @param {string} input raw paste from the Google Maps embed dialog
 * @returns {{ map_embed_src: string, latitude: number|null, longitude: number|null }}
 * @throws {Error} with .status 400 when the paste isn't a usable Google Maps embed
 */
export function parseMapEmbed(input) {
  if (!input || !String(input).trim()) {
    return { map_embed_src: '', latitude: null, longitude: null }
  }

  const src = extractSrc(String(input))
  if (!src) {
    throw Object.assign(
      new Error(
        'That does not look like a map embed. In Google Maps open Share > Embed a map > Copy HTML, then paste the whole <iframe> here.'
      ),
      { status: 400 }
    )
  }

  let url
  try {
    url = new URL(src)
  } catch {
    throw Object.assign(new Error('The map embed contains a malformed URL.'), { status: 400 })
  }

  if (url.protocol !== 'https:') {
    throw Object.assign(new Error('The map embed must be an https:// link.'), { status: 400 })
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw Object.assign(
      new Error(`Map embeds must come from Google Maps — got "${url.hostname}".`),
      { status: 400 }
    )
  }
  // Two URL shapes actually render a map in an iframe: the /maps/embed form the
  // Embed dialog produces, and the older /maps?...&output=embed form. A plain
  // "Share > Copy link" URL renders a consent page instead, so reject it.
  const isEmbedPath = url.pathname.startsWith('/maps/embed')
  const isOutputEmbed = url.pathname.startsWith('/maps') && url.searchParams.get('output') === 'embed'
  if (!isEmbedPath && !isOutputEmbed) {
    throw Object.assign(
      new Error(
        'That is a share link, not an embed. Use the "Embed a map" tab in the Share dialog and copy the HTML it gives you.'
      ),
      { status: 400 }
    )
  }

  const { latitude, longitude } = extractCoords(src)
  const usable = latitude !== null && longitude !== null && inPhilippines(latitude, longitude)

  return {
    map_embed_src: url.toString(),
    latitude: usable ? latitude : null,
    longitude: usable ? longitude : null,
  }
}
