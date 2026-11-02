import type { Translate } from "@qticaret/ui"
import type { NewsletterWords } from "./NewsletterForm"

const NEWSLETTER_ERRORS = [
  "newsletter.email_invalid",
  "newsletter.rate_limited",
  "errors.challenge_failed",
]

/** A newsletter box's words: its title and line as the shop wrote them, the rest the storefront's. */
export const newsletterWords = (t: Translate, title: string, text: string): NewsletterWords => ({
  title,
  text,
  privacyLink: t("newsletter.privacy_link"),
  email: t("newsletter.email"),
  submit: t("newsletter.submit"),
  sent: t("newsletter.sent"),
  errors: Object.fromEntries(NEWSLETTER_ERRORS.map((key) => [key, t(key)])),
  fallback: t("newsletter.failed"),
})
