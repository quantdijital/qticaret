import type { ImageView } from "./views"

/**
 * `/ode/<token>` (adr/0051): the order staff put together for a customer,
 * and the button that turns it into a cart at checkout. Amounts come in
 * words; the storefront formats them.
 */

/** One line as staff set it: "2 × 150,00 TL", "300,00 TL". */
export interface PaymentLinkLineView {
  title: string
  /** The variant's name; null when the product has one variant. */
  detail: string | null
  quantity: number
  unitPrice: string
  total: string
  image: ImageView | null
  /** False: the shelf cannot fill the line now; the line says so. */
  inStock: boolean
}

/** What the link offers, in words. */
export interface PaymentLinkOrderView {
  /** "PL-1042". */
  number: string
  /** For the greeting; null greets without a name. */
  firstName: string | null
  lines: PaymentLinkLineView[]
  /** Items before the discount. */
  items: string
  /** The discount; null when the link gives none. */
  discount: string | null
  /** Items after the discount; shipping comes at checkout. */
  total: string
  /** Whether the shop chose the shipping option beforehand. */
  shippingPreset: boolean
  /** "5 Kasım 2026 14:00", Türkiye's time. */
  expires: string
}

/** The button: the form's hidden fields and, when pressing replaces a cart, a warning. */
export interface PaymentLinkPayView {
  fields: { name: string; value: string }[]
  warning: string | null
}

export interface PaymentLinkPageView {
  /**
   * Null: the link opens nothing. Unknown, forged, ended, paid and
   * canceled links read alike (the backend's one 404).
   */
  order: PaymentLinkOrderView | null
  /** Said above the summary, in words: prices moved, a line ran out, try later. */
  notice: string | null
  /** Null: no button (prices moved, or the button's answer is on the page). */
  pay: PaymentLinkPayView | null
}
