/**
 * A Google review's own link (adr/0058 Ek 2026-11-27): the review open on
 * Google Maps, as Maps and the Places API (`Review.googleMapsUri`) write it:
 * `https://www.google.com/maps/reviews/data=!4m6!14m5!1m4!2m3!1s{id}!2m1!1s0x0:0x{cid}`,
 * with the review's Maps id (`mapsReviewIdOf`) and the place's CID in hex,
 * read from the location's `metadata.mapsUri` (`https://maps.google.com/maps?cid=…`).
 * Null when either is missing: the storefront links to the place instead.
 */

const CID = /^[1-9]\d{0,19}$/
const MAPS_REVIEW_ID = /^[A-Za-z0-9_-]{16,512}$/
const MAX_CID = 2n ** 64n - 1n

/** The place's CID in hex from its Maps address (`?cid=` in decimal), or null. */
export function cidHexOf(mapsUri: string | null): string | null {
  if (!mapsUri) {
    return null
  }
  try {
    const cid = new URL(mapsUri).searchParams.get("cid") ?? ""
    if (!CID.test(cid)) {
      return null
    }
    const value = BigInt(cid)
    return value <= MAX_CID ? value.toString(16) : null
  } catch {
    return null
  }
}

/** The review open on Google Maps, or null without its Maps id or the place's CID. */
export function reviewLinkOf(mapsReviewId: string | null, mapsUri: string | null): string | null {
  const cid = cidHexOf(mapsUri)
  if (!mapsReviewId || !MAPS_REVIEW_ID.test(mapsReviewId) || !cid) {
    return null
  }
  return `https://www.google.com/maps/reviews/data=!4m6!14m5!1m4!2m3!1s${mapsReviewId}!2m1!1s0x0:0x${cid}?hl=tr`
}
