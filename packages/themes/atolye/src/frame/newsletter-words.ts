import type { Translate } from "@qticaret/ui"

export interface NewsletterWords {
  /** The shop's consent sentence (İYS): the box's label, never ticked for the visitor. */
  consent: string
  privacyLink: string
  email: string
  submit: string
  sent: string
  errors: Record<string, string>
  fallback: string
}

const NEWSLETTER_ERRORS = [
  "newsletter.email_invalid",
  "newsletter.rate_limited",
  "errors.challenge_failed",
]

/** A newsletter form's words: the consent sentence as the shop wrote it, the rest the storefront's. */
export const newsletterWords = (t: Translate, consent: string): NewsletterWords => ({
  consent,
  privacyLink: t("newsletter.privacy_link"),
  email: t("newsletter.email"),
  submit: t("newsletter.submit"),
  sent: t("newsletter.sent"),
  errors: Object.fromEntries(NEWSLETTER_ERRORS.map((key) => [key, t(key)])),
  fallback: t("newsletter.failed"),
})
