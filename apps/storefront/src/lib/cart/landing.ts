/**
 * Where a visit first landed from (F11.2, adr/0039 §2): the campaign's
 * `utm_*` words, the referring site (another site's origin only: its page
 * may name a person) and whether an ad click id was there, never the ids
 * themselves. Nothing of the person:
 * kept in a session cookie by the proxy at the first page, read when the
 * visit's first cart is made and sent to the backend with it.
 */
export const LANDING_COOKIE = "qt_landing"

export interface Landing {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  referrer?: string
  gclid?: boolean
  fbclid?: boolean
}

const WORD = /^[\p{L}\p{N} ._\-+/:]{1,100}$/u

/** The landing a request shows, or null when it says nothing (a direct visit, our own pages). */
export function landingOf(url: URL, referer: string | null): Landing | null {
  const landing: Landing = {}
  for (const key of ["utm_source", "utm_medium", "utm_campaign"] as const) {
    const value = url.searchParams.get(key)?.trim()
    if (value && WORD.test(value)) {
      landing[key] = value
    }
  }
  if (url.searchParams.has("gclid")) {
    landing.gclid = true
  }
  if (url.searchParams.has("fbclid")) {
    landing.fbclid = true
  }
  const from = referer ? URL.parse(referer) : null
  if (from && /^https?:$/.test(from.protocol) && from.host !== url.host) {
    // Only the site: the backend keeps the host, and a page's path may name a person
    landing.referrer = `${from.origin}/`
  }
  return Object.keys(landing).length > 0 ? landing : null
}

/** A cookie's longest value read or written: well under a browser's 4 KB and a proxy's buffer. */
export const LANDING_MAX_LENGTH = 2500

/** The cookie's value, or null when it would be too long to keep. */
export function landingCookieValue(landing: Landing): string | null {
  const value = encodeURIComponent(JSON.stringify(landing))
  return value.length > LANDING_MAX_LENGTH ? null : value
}

export function readLanding(value: string | undefined): Landing | null {
  if (!value || value.length > LANDING_MAX_LENGTH) {
    return null
  }
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Landing
    return typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}
