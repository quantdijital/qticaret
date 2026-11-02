import type { CookieConsent } from "../views/cookies"
import type { TrackingIds } from "./ids"

/** What the visitor allowed in the cookie banner (adr/0041 §5, adr/0038 §4). */
export interface MeasureConsent {
  analytics: boolean
  marketing: boolean
}

export const NO_CONSENT: MeasureConsent = { analytics: false, marketing: false }

/**
 * The answer in force: only one given under the cookie policy now. None
 * yet, one under an older policy (the banner asks again), or an answer
 * that could not be read: nothing is allowed.
 */
export function measureConsentOf(state: CookieConsent | null): MeasureConsent {
  if (!state?.consent) {
    return NO_CONSENT
  }
  const { consent, policy_version } = state
  return consent.policy_version === policy_version
    ? { analytics: consent.analytics, marketing: consent.marketing }
    : NO_CONSENT
}

/**
 * The tags this visitor may get (KK5): GA4 with the analytics consent,
 * Meta's pixel with the marketing one; a tag the shop did not connect, never.
 */
export function allowedTags(ids: TrackingIds, consent: MeasureConsent): TrackingIds {
  return {
    ga4: consent.analytics ? ids.ga4 : null,
    meta: consent.marketing ? ids.meta : null,
  }
}
