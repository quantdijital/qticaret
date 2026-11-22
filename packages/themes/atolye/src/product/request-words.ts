import type { Translate } from "@qticaret/ui"

/**
 * A dated product's "call me" form words (adr/0076 Ek 2026-11-23; docs/19
 * §6.2: translated here, never `t` in the browser), and the action's
 * message keys.
 */

/** What `requestBooking` can come back with (the storefront's own keys). */
export const REQUEST_ERRORS = [
  "booking_request.invalid",
  "booking_request.phone_invalid",
  "booking_request.email_invalid",
  "booking_request.email_domain",
  "booking_request.consent_required",
  "booking_request.when_invalid",
  "booking_request.people_invalid",
  "booking_request.rate_limited",
  "booking_request.failed",
  "errors.challenge_failed",
]

export const requestWords = (t: Translate) => ({
  title: t("booking_request.title"),
  intro: t("booking_request.intro"),
  open: t("booking_request.open"),
  name: t("booking_request.name"),
  phone: t("booking_request.phone"),
  email: t("booking_request.email"),
  optional: t("booking_request.optional"),
  when: t("booking_request.when"),
  month: t("booking_request.month"),
  monthField: t("booking_request.month_field"),
  flexible: t("booking_request.flexible"),
  adults: t("booking_request.adults"),
  children: t("booking_request.children"),
  note: t("booking_request.note"),
  consent: t("booking_request.consent"),
  privacyLink: t("booking_request.privacy_link"),
  submit: t("booking_request.submit"),
  checking: t("booking_request.checking"),
  sent: t("booking_request.sent"),
  errors: Object.fromEntries(REQUEST_ERRORS.map((key) => [key, t(key)])) as Record<string, string>,
  fallback: t("booking_request.failed"),
})

export type RequestWords = ReturnType<typeof requestWords>
