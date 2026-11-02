import type { CookieBannerView } from "@qticaret/ui"

/** The backend's cookie answer and policy (`GET /store/consents/cookies`). */
export interface CookieConsent {
  consent: { analytics: boolean; marketing: boolean; policy_version: number | null } | null
  policy_version: number | null
}

/** `/cerez-tercihleri`: the cookie choices on a page of their own (D9). */
export const COOKIE_PREFERENCES_PATH = "/cerez-tercihleri"

/** Whether the banner asks: no answer yet, or one under an older policy. */
export const bannerDue = (state: CookieConsent): boolean =>
  state.consent?.policy_version !== state.policy_version

/**
 * The cookie banner (D9): due until the visitor answers under the policy
 * now, its boxes ticked as the answer in force (none while one is due: an
 * older policy's answer does not tick the new one's boxes). Not due on the
 * page that asks the same (`askedHere`). Null when the answer could not be read.
 */
export function cookieBannerOf(
  state: CookieConsent | null,
  policyPath: string | null,
  askedHere = false
): CookieBannerView | null {
  if (!state) {
    return null
  }
  const due = bannerDue(state)
  return {
    policyVersion: state.policy_version,
    policyPath,
    due: due && !askedHere,
    analytics: !due && (state.consent?.analytics ?? false),
    marketing: !due && (state.consent?.marketing ?? false),
  }
}
