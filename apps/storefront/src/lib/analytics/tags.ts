import "server-only"
import { cookieConsent } from "../legal/cookies"
import { siteSeo } from "../store-api/requests"
import type { AllowedTags } from "./client"
import { allowedTags, measureConsentOf } from "./consent"
import { trackingIdsOf } from "./ids"

/**
 * The tags this visitor gets (docs/20, D9): the shop's connected ids
 * (`/store/seo/site` `tracking`) within the visitor's cookie answer. The
 * browser learns an id only when it may load its tag.
 */
export async function analyticsTags(): Promise<AllowedTags> {
  const [site, consent] = await Promise.all([siteSeo().catch(() => null), cookieConsent()])
  const measure = measureConsentOf(consent)
  return { ...allowedTags(trackingIdsOf(site?.tracking), measure), adSignals: measure.marketing }
}
