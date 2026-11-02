/**
 * The shop's measurement tags as the backend names them (`GET
 * /store/seo/site` `tracking`, F10.9): public ids only. Each is held to
 * its own form here too: an id goes into a script's address and the CSP
 * opens hosts for it, so anything else reads as "not connected".
 */
export interface TrackingIds {
  /** GA4's web stream, `G-XXXX`. */
  ga4: string | null
  /** Meta's pixel, digits. */
  meta: string | null
}

export const NO_TRACKING: TrackingIds = { ga4: null, meta: null }

const GA4 = /^G-[A-Z0-9]{4,20}$/
const META = /^\d{5,20}$/

const matching = (value: unknown, form: RegExp): string | null =>
  typeof value === "string" && form.test(value) ? value : null

export function trackingIdsOf(raw: unknown): TrackingIds {
  if (typeof raw !== "object" || raw === null) {
    return NO_TRACKING
  }
  const tracking = raw as { ga4_measurement_id?: unknown; meta_pixel_id?: unknown }
  return {
    ga4: matching(tracking.ga4_measurement_id, GA4),
    meta: matching(tracking.meta_pixel_id, META),
  }
}
