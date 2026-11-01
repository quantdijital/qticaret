/**
 * Where a visit first landed from (F11.2, adr/0039 §2): the campaign's
 * `utm_*` words, the referring page (another site's only) and whether an
 * ad click id was there, never the ids themselves. Nothing of the person:
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
    // Only where it came from: the page without its query (a search's words stay there)
    landing.referrer = `${from.origin}${from.pathname}`.slice(0, 2000)
  }
  return Object.keys(landing).length > 0 ? landing : null
}

export function readLanding(value: string | undefined): Landing | null {
  if (!value || value.length > 2500) {
    return null
  }
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Landing
    return typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}
