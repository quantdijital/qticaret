import "server-only"
import { cache } from "react"
import { currentWholesale } from "../account/wholesale"
import { cookieConsent } from "../legal/cookies"
import { siteSeo } from "../store-api/requests"
import type { AllowedTags } from "./client"
import { allowedTags, measureConsentOf } from "./consent"
import { trackingIdsOf } from "./ids"

/**
 * The tags this visitor gets (docs/20, D9): the shop's connected ids
 * (`/store/seo/site` `tracking`) within the visitor's cookie answer. The
 * browser learns an id only when it may load its tag. A signed-in
 * wholesaler's events go without amounts (ADR-0068 §7, `amounts.ts`);
 * asked whether a tag is allowed or not (a page drawn before the cookie
 * answer may be shown again after it), and when the answer cannot be had,
 * without amounts too. Asked once per request (React `cache`): by the
 * frame and, on every page with events of its own, for `TrackEvents`
 * (`visitorAmounts`; slice 5 review L1: the frame is not drawn again on a
 * soft navigation).
 */
export const analyticsTags = cache(async (): Promise<AllowedTags> => {
  const [site, consent, amounts] = await Promise.all([
    siteSeo().catch(() => null),
    cookieConsent(),
    // With no tag allowed too (review of L1): a page drawn before the cookie answer and shown
    // again after it must not say "amounts" for a wholesaler (a guest is never asked)
    currentWholesale().then(
      (wholesale) => !wholesale.active,
      () => false
    ),
  ])
  const measure = measureConsentOf(consent)
  const tags = allowedTags(trackingIdsOf(site?.tracking), measure)
  return { ...tags, adSignals: measure.marketing, amounts }
})

/** Whether this request's visitor's events carry amounts: a page's word for `TrackEvents`. */
export async function visitorAmounts(): Promise<boolean> {
  return (await analyticsTags()).amounts
}
