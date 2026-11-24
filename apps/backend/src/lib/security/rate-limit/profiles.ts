/**
 * Rate limit profiles (docs/04: login, registration, password reset,
 * checkout, installment queries, coupons, SMS, webhooks). Each profile has
 * up to two limits: per client IP (an IPv6 client by its /64), and per IP
 * and identity (an e-mail, a cart, a phone number). One address cannot spray
 * many accounts, nor guess one account quickly. Guessing from many addresses
 * at once (a botnet) needs a limit per identity across addresses, which comes
 * with account lockout and its notice (docs/04 "artan gecikme + kilit").
 */

import type { RateLimitProfile } from "@qticaret/server-kit"

// The profile shape is shared with the control plane (adr/0061, C3)
export type { Limit, RateLimitProfile } from "@qticaret/server-kit"

const MINUTE = 60_000
const HOUR = 60 * MINUTE

export const RATE_LIMIT_PROFILES = {
  login: {
    name: "login",
    perIp: { max: 50, windowMs: 15 * MINUTE },
    perIdentity: { max: 10, windowMs: 15 * MINUTE },
  },
  register: { name: "register", perIp: { max: 10, windowMs: HOUR } },
  password_reset: {
    name: "password_reset",
    perIp: { max: 20, windowMs: HOUR },
    perIdentity: { max: 5, windowMs: HOUR },
  },
  token_refresh: { name: "token_refresh", perIp: { max: 60, windowMs: 15 * MINUTE } },
  auth_default: { name: "auth_default", perIp: { max: 120, windowMs: 15 * MINUTE } },
  store_default: { name: "store_default", perIp: { max: 600, windowMs: MINUTE } },
  // The storefront's server (adr/0046 §5) asks a few calls per page it makes,
  // for the shopper whose address it signed: counted per that address, in a
  // wider bucket than a client calling the API directly. Logins, checkout,
  // codes and the rest keep their own, unchanged profiles.
  storefront_default: { name: "storefront_default", perIp: { max: 3000, windowMs: MINUTE } },
  admin_default: { name: "admin_default", perIp: { max: 1200, windowMs: MINUTE } },
  // Wired by their phases (F4 coupons, F5/F6 checkout and installments,
  // F9 SMS, webhooks per provider)
  checkout: {
    name: "checkout",
    perIp: { max: 60, windowMs: MINUTE },
    perIdentity: { max: 20, windowMs: MINUTE },
    // The cart's own budget, however many addresses start or complete it
    perIdentityAnyIp: { max: 30, windowMs: 10 * MINUTE },
  },
  // adr/0076 Ek: holding a departure's places, apart from the checkout's
  // budget. Per address it is tighter (each hold keeps places from others
  // for its life); per cart a shopper may change dates and people freely
  booking: {
    name: "booking",
    perIp: { max: 30, windowMs: 10 * MINUTE },
    perIdentity: { max: 20, windowMs: MINUTE },
    perIdentityAnyIp: { max: 40, windowMs: 10 * MINUTE },
  },
  coupon: {
    name: "coupon",
    perIp: { max: 30, windowMs: 10 * MINUTE },
    perIdentity: { max: 10, windowMs: 10 * MINUTE },
    // The cart's own budget, however many addresses try codes on it
    perIdentityAnyIp: { max: 10, windowMs: 10 * MINUTE },
  },
  installment: { name: "installment", perIp: { max: 30, windowMs: MINUTE } },
  // adr/0025 Ek 2026-11-03: a gift card's balance by its code; each ask is a guess at a code
  gift_card_balance: { name: "gift_card_balance", perIp: { max: 10, windowMs: MINUTE } },
  // adr/0076 Ek D7b: staff checking a booking voucher's code at a departure; a group
  // boards in minutes, but codes are never tried in bulk (80 random bits besides)
  voucher_check: {
    name: "voucher_check",
    perIp: { max: 120, windowMs: 10 * MINUTE },
    perIdentity: { max: 60, windowMs: 10 * MINUTE },
  },
  // F18 D4: a listing's filtered page reads its whole listing once a cache
  // window; per the shopper's address, signed by the storefront or not
  listing: { name: "listing", perIp: { max: 120, windowMs: MINUTE } },
  // A storefront page's card facts (adr/0046 Ek 2026-11-04); a date search's read the
  // departures in its dates (adr/0077 §4). A page asks once a listing, once a home rail
  card_facts: { name: "card_facts", perIp: { max: 240, windowMs: MINUTE } },
  // A month's departure calendar (adr/0077 §6): asked as a shopper opens the date
  // picker or turns a month; each answer is kept a minute, a miss reads the month
  departure_calendar: { name: "departure_calendar", perIp: { max: 60, windowMs: MINUTE } },
  // Upcoming departures (adr/0077 §10): a home page's section asks once a page view;
  // each answer is kept 30 seconds, a miss reads the nearest departures
  upcoming_departures: { name: "upcoming_departures", perIp: { max: 60, windowMs: MINUTE } },
  // The header's live search (2026-11-05): a read as the shopper types, after a
  // pause; the storefront keeps each answer a minute, so a word asked again is free
  search_suggest: { name: "search_suggest", perIp: { max: 240, windowMs: MINUTE } },
  // F10.6 (adr/0037 §4): a customer writing reviews; per IP and per customer
  review_write: {
    name: "review_write",
    perIp: { max: 20, windowMs: HOUR },
    perIdentity: { max: 10, windowMs: HOUR },
  },
  // A review's photos (adr/0037 §4 Ek 2026-11-04): three a review, a few tries over
  review_photo: {
    name: "review_photo",
    perIp: { max: 30, windowMs: HOUR },
    perIdentity: { max: 20, windowMs: HOUR },
  },
  // F10.5 (adr/0037 §4): a stock alert may mail a confirmation; per IP and per address
  stock_alert: {
    name: "stock_alert",
    perIp: { max: 10, windowMs: 15 * MINUTE },
    perIdentity: { max: 5, windowMs: HOUR },
  },
  // adr/0071 §8: staff asking the AI core for a text suggestion; each is a call to a
  // service at the shop's cost, beside the daily ceiling and the monthly limit
  ai_text: {
    name: "ai_text",
    perIp: { max: 30, windowMs: 10 * MINUTE },
    perIdentityAnyIp: { max: 20, windowMs: 10 * MINUTE },
  },
  // adr/0074 §2 "Dene" (#247 D1): one try is two text calls and a correction each at
  // most, so a budget of its own: five tries a staff member, wherever they are
  ai_preview: {
    name: "ai_preview",
    perIp: { max: 10, windowMs: 10 * MINUTE },
    perIdentityAnyIp: { max: 5, windowMs: 10 * MINUTE },
  },
  // adr/0071 §8: image and video work, dearer and slower than text: narrower
  ai_media: {
    name: "ai_media",
    perIp: { max: 10, windowMs: 10 * MINUTE },
    perIdentityAnyIp: { max: 10, windowMs: 10 * MINUTE },
  },
  // adr/0077 §7: a shopper's sentence read by the shop's AI service, each a call at the
  // shop's cost through a public route: five a minute and thirty a day per address, beside
  // the shop's own daily ceiling (AI_STORE_SEARCH_DAILY_LIMIT) and the day's cache
  ai_store_search: { name: "ai_store_search", perIp: { max: 5, windowMs: MINUTE } },
  ai_store_search_daily: {
    name: "ai_store_search_daily",
    perIp: { max: 30, windowMs: 24 * HOUR },
  },
  // The media library bringing in an image by its address: each is a fetch from the internet
  media_import: { name: "media_import", perIp: { max: 60, windowMs: 10 * MINUTE } },
  // A product video's upload (adr/0069 §3): up to 50 MB and an ffprobe run each; per
  // address and per staff member wherever they are
  media_video: {
    name: "media_video",
    perIp: { max: 10, windowMs: 10 * MINUTE },
    perIdentityAnyIp: { max: 10, windowMs: 10 * MINUTE },
  },
  // F10.8 (adr/0038 §3): Google, Meta and the like fetching a feed; a guess finds nothing
  feed: { name: "feed", perIp: { max: 60, windowMs: 15 * MINUTE } },
  // F10.7 (adr/0038 §1): a cart reminder's link back to the cart; a guess finds nothing
  cart_return: { name: "cart_return", perIp: { max: 30, windowMs: 15 * MINUTE } },
  // F10.1 (adr/0037 §2): "find my order" mails the order's link; per IP and per address
  order_lookup: {
    name: "order_lookup",
    perIp: { max: 10, windowMs: 15 * MINUTE },
    perIdentity: { max: 3, windowMs: HOUR },
  },
  // F18 D10 (adr/0047): the contact form; per address and per sender's e-mail
  contact_message: {
    name: "contact_message",
    perIp: { max: 10, windowMs: HOUR },
    perIdentity: { max: 5, windowMs: HOUR },
  },
  // adr/0076 Ek 2026-11-23: a booking request's phone counted on its own,
  // beside the contact form's profile (which counts its address)
  booking_request_phone: {
    name: "booking_request_phone",
    perIdentity: { max: 5, windowMs: HOUR },
  },
  // F18: the newsletter box mails a confirmation; per address and per e-mail
  newsletter: {
    name: "newsletter",
    perIp: { max: 10, windowMs: HOUR },
    perIdentity: { max: 3, windowMs: HOUR },
  },
  // F18: a draft's signed preview link; a guess finds nothing
  content_preview: { name: "content_preview", perIp: { max: 60, windowMs: 15 * MINUTE } },
  // adr/0065: the theme editor's live preview reads the draft after every save (a
  // redraw a second at most); a guessed token finds nothing
  layout_session: { name: "layout_session", perIp: { max: 120, windowMs: MINUTE } },
  // adr/0065: opening the theme editor's live preview; per staff member
  layout_session_open: {
    name: "layout_session_open",
    perIdentityAnyIp: { max: 60, windowMs: HOUR },
  },
  // adr/0064 Ek 2026-11-17: saving, renaming and removing saved looks; per staff member
  storefront_design_write: {
    name: "storefront_design_write",
    perIdentityAnyIp: { max: 60, windowMs: HOUR },
  },
  // adr/0064: a look applied to the draft (each keeps the draft first and checks the design)
  storefront_design_apply: {
    name: "storefront_design_apply",
    perIdentityAnyIp: { max: 20, windowMs: HOUR },
  },
  // adr/0064 Ek 2026-11-17: the draft discarded or a revision restored (each keeps
  // the draft first as an automatic save); per staff member, an editor's routine
  storefront_draft_replace: {
    name: "storefront_draft_replace",
    perIdentityAnyIp: { max: 60, windowMs: HOUR },
  },
  // adr/0053: the storefront checking a visitor's maintenance bypass (it keeps
  // the answer a minute); per the visitor's address, a guess finds nothing
  maintenance_bypass: { name: "maintenance_bypass", perIp: { max: 60, windowMs: MINUTE } },
  // F14.5: a moved customer's claim key, guessed at nowhere: a few tries an hour
  migration_claim: {
    name: "migration_claim",
    perIp: { max: 10, windowMs: 15 * MINUTE },
    perIdentity: { max: 5, windowMs: HOUR },
  },
  // F7.13: a shopper cancelling an order; each may ask a provider for a refund
  order_cancel: {
    name: "order_cancel",
    perIp: { max: 20, windowMs: 10 * MINUTE },
    perIdentity: { max: 5, windowMs: 10 * MINUTE },
  },
  // F7.9: a shopper asking to return lines of an order; a budget of its own
  return_request: {
    name: "return_request",
    perIp: { max: 20, windowMs: 10 * MINUTE },
    perIdentity: { max: 5, windowMs: 10 * MINUTE },
  },
  // F7.7: shipping picked orders at once, each asking a carrier for a label
  bulk_ship: {
    name: "bulk_ship",
    perIp: { max: 10, windowMs: MINUTE },
    perIdentityAnyIp: { max: 30, windowMs: 10 * MINUTE },
  },
  // F6: a checkout page's ways to pay; each may run the providers' health check
  payment_methods: { name: "payment_methods", perIp: { max: 60, windowMs: MINUTE } },
  sms: {
    name: "sms",
    perIp: { max: 10, windowMs: HOUR },
    perIdentity: { max: 3, windowMs: 10 * MINUTE },
  },
  webhook: { name: "webhook", perIp: { max: 600, windowMs: MINUTE } },
  // adr/0072 §3: BirFatura pulling the shop's orders (buyers' details): per address,
  // before the token is looked at
  einvoice_pull: { name: "einvoice_pull", perIp: { max: 60, windowMs: MINUTE } },
  // adr/0072 §3: the shop's own budget from any address (one identity), counted after
  // the token only: calls without it never use up BirFatura's
  einvoice_pull_shop: {
    name: "einvoice_pull_shop",
    perIdentityAnyIp: { max: 120, windowMs: MINUTE },
  },
  // adr/0072 §3: wrong BirFatura tokens, counted apart and only when wrong; past
  // this an address is refused before its token is looked at, right or not
  einvoice_pull_auth: { name: "einvoice_pull_auth", perIp: { max: 10, windowMs: MINUTE } },
  // adr/0061 Ek C9: the control plane's plan document pushes; a handful a day per shop
  control_plane_push: { name: "control_plane_push", perIp: { max: 60, windowMs: MINUTE } },
  // F5 V9: a shopper's browser back from a hosted form (iyzico), once per payment
  payment_return: {
    name: "payment_return",
    perIp: { max: 20, windowMs: MINUTE },
    perIdentityAnyIp: { max: 10, windowMs: 10 * MINUTE },
  },
  // F3.5: the storefront's 404 reports; beyond this a flood is not worth counting
  seo_report: { name: "seo_report", perIp: { max: 30, windowMs: MINUTE } },
  // F11.6: a secret API key's calls, wherever it calls from (adr/0039 §6)
  api_key: {
    name: "api_key",
    perIp: { max: 1200, windowMs: MINUTE },
    perIdentityAnyIp: { max: 600, windowMs: MINUTE },
  },
  // A staff member's own password tried (a password or an address change; the
  // owner, 2026-11-06): per member from any address, apart from sign-ins' budget.
  // Wrong ones also count in the step-up's tally (thirty a day, api/http/reauth.ts)
  own_password: {
    name: "own_password",
    perIp: { max: 30, windowMs: 15 * MINUTE },
    perIdentityAnyIp: { max: 10, windowMs: 15 * MINUTE },
  },
  // A new sign-in address asked for: each mails a stranger's inbox in the shop's name
  staff_email_request: {
    name: "staff_email_request",
    perIdentityAnyIp: { max: 5, windowMs: 24 * HOUR },
  },
  // The link to a new address confirmed, by the member signed in
  staff_email_confirm: {
    name: "staff_email_confirm",
    perIp: { max: 30, windowMs: 15 * MINUTE },
    perIdentityAnyIp: { max: 10, windowMs: 15 * MINUTE },
  },
  // ADR-0068 §7: a wholesaler's own prices, asked by the storefront's server for each
  // page's cards (a hundred variants a call); per customer from any address too
  wholesale_prices: {
    name: "wholesale_prices",
    perIp: { max: 600, windowMs: MINUTE },
    perIdentityAnyIp: { max: 600, windowMs: MINUTE },
  },
  // F5 (adr/0027): saving or testing a provider account calls the provider
  // and per staff member from any address: not an oracle for other people's details
  provider_check: {
    name: "provider_check",
    perIp: { max: 20, windowMs: MINUTE },
    perIdentityAnyIp: { max: 60, windowMs: HOUR },
  },
} as const satisfies Record<string, RateLimitProfile>

export type RateLimitProfileName = keyof typeof RATE_LIMIT_PROFILES

// Shared with the control plane (adr/0061, C3)
export { perIpScale } from "@qticaret/server-kit"
