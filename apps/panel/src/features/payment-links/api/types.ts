/**
 * Payment links (adr/0051) as the API gives them: the backend's
 * `/admin/payment-links*` routes and their views (`workflows/payment-links/views.ts`).
 * Every amount is kuruş and worked out by the backend; the panel only shows it.
 */

/** The flag the screens and their routes live behind; off, the API answers 404. */
export const PAYMENT_LINKS_FLAG = "orders.payment_links"

/** `draft`: a price moved after the link was made; it opens nothing for the customer. */
export const LINK_STATUSES = ["open", "draft", "paid", "expired", "canceled"] as const
export type LinkStatus = (typeof LINK_STATUSES)[number]

export const DISCOUNT_TYPES = ["percentage", "fixed"] as const
export type DiscountType = (typeof DISCOUNT_TYPES)[number]

export interface LinkDiscount {
  type: DiscountType
  /** Percent for `percentage`, kuruş for `fixed`. */
  value: number
  /** Kuruş off the lines, as the backend worked it out. */
  amount: number
  reason: string
}

/** A list row: the customer masked ("Ayşe Y.", "a***@example.com"). */
export interface PaymentLinkSummary {
  id: string
  /** "PL-1042" */
  number: string
  status: LinkStatus
  customer: { id: string | null; name: string | null; email: string | null }
  items_total: number
  discount_total: number
  total: number
  discount: LinkDiscount | null
  currency_code: string
  /** The staff member's user id. */
  created_by: string
  /** Their name, when the backend sends it (any role reads it there; the team list is the owner's). */
  created_by_name?: string | null
  created_at: string
  expires_at: string
  opened_count: number
  sent_count: number
  order_id: string | null
}

export interface LinkLine {
  variant_id: string
  product_id: string | null
  quantity: number
  title: string
  variant_title: string | null
  thumbnail: string | null
  /** Kuruş, KDV included: the catalog's price when the link was made (or now, in a preview). */
  unit_price: number
  total: number
}

export interface LinkContact {
  first_name: string
  last_name: string
  email: string
  phone: string | null
}

/** A Turkish address: `province` is the il, `city` the ilçe. */
export interface LinkAddress {
  first_name: string
  last_name: string
  phone: string | null
  address_1: string
  address_2: string | null
  city: string
  province: string
  postal_code: string | null
}

/** `GET /admin/payment-links/:id`: the customer in full (a recorded read). */
export interface PaymentLink extends PaymentLinkSummary {
  contact: LinkContact | null
  address: LinkAddress | null
  lines: LinkLine[]
  shipping_option_id: string | null
  note: string | null
  /** The latest the link can ever open: seven days from its making. */
  token_ends_at: string
  cart_id: string | null
  last_opened_at: string | null
  last_sent_at: string | null
  paid_at: string | null
  canceled_by: string | null
  /** Who cancelled it, by name, when the backend sends it. */
  canceled_by_name?: string | null
  closed_at: string | null
}

export interface PaymentLinkList {
  payment_links: PaymentLinkSummary[]
  count: number
  limit: number
  offset: number
}

/** What staff copy or open; the texts are null once the link no longer opens. */
export interface LinkShare {
  url: string | null
  sms_text: string | null
  whatsapp_url: string | null
  email_sent: boolean
  sms_sent: boolean
}

/** `POST /admin/payment-links/preview`: the form's summary, priced by the backend. */
export interface LinkPreview {
  lines: LinkLine[]
  items_total: number
  discount: LinkDiscount | null
  total: number
  /** Variants short on the shelf now: a warning, the link is still made (adr/0051 §6). */
  short_variant_ids: string[]
  currency_code: string
}

export interface LineInput {
  variant_id: string
  quantity: number
}

export interface DiscountInput {
  type: DiscountType
  /** Percent (1–99) or kuruş. */
  value: number
  reason: string
}

export interface PreviewInput {
  customer_id?: string
  lines: LineInput[]
  discount?: DiscountInput
  shipping_option_id?: string
}

export interface GuestInput {
  first_name: string
  last_name: string
  email: string
  phone?: string
}

export interface AddressInput {
  first_name: string
  last_name: string
  phone?: string
  address_1: string
  address_2?: string
  city: string
  province: string
  postal_code?: string
}

/** `POST /admin/payment-links`: a customer or a guest, never a price. */
export interface LinkInput extends PreviewInput {
  guest?: GuestInput
  address?: AddressInput
  note?: string
  expires_in_hours: number
}

export const RESEND_CHANNELS = ["email", "sms"] as const
export type ResendChannel = (typeof RESEND_CHANNELS)[number]

/** What a channel came to (`workflows/messaging/deliver.ts`). */
export const SEND_OUTCOMES = [
  "sent",
  "duplicate",
  "channel_off",
  "invalid_recipient",
  "suppressed",
  "no_consent",
  "over_quota",
  "failed",
] as const
export type SendOutcome = (typeof SEND_OUTCOMES)[number]

export type ResendOutcomes = Partial<Record<ResendChannel, SendOutcome>>

/** Settings > the `payment_links` section; the owner's to change. */
export interface PaymentLinkSettings {
  /** The largest discount an admin may give, percent of the lines (0–99). */
  admin_max_discount_percent: number
  /** Whether a link's order may be paid at the door. */
  allow_cod: boolean
}
