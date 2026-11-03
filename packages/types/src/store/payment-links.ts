/**
 * A payment link staff made in the panel (adr/0051): the order they put
 * together, as its customer's page `/ode/<token>` shows it. Amounts are
 * kuruş, KDV in. Of the person, the first name only.
 */

/** One line as staff set it, at the price the link was made with. */
export interface StorePaymentLinkLine {
  variant_id: string
  title: string
  variant_title: string | null
  thumbnail: string | null
  quantity: number
  /** Kuruş, per unit. */
  unit_price: number
  /** Kuruş: `unit_price × quantity`. */
  total: number
  /** False while the shelf cannot fill the line: "Ödemeye geç" answers 409 then. */
  in_stock: boolean
}

/**
 * `GET /store/payment-links/:token`. A link that opens nothing (unknown,
 * forged, ended, paid, canceled, or the shop has links off) is one 404
 * (`payment_link.unavailable`, or a bare 404 while the flag is off).
 */
export interface StorePaymentLink {
  /** "PL-1042". */
  number: string
  /** `prices_changed`: the catalog moved since; the shop sends a new link, nothing opens. */
  state: "open" | "prices_changed"
  first_name: string | null
  currency_code: string
  lines: StorePaymentLinkLine[]
  items_total: number
  discount_total: number
  /** `items_total − discount_total`; shipping comes at checkout. */
  total: number
  /** Whether staff chose the shipping option (with the address) beforehand. */
  shipping: { preset: boolean }
  /** ISO time the link stops opening. */
  expires_at: string
}

/** `POST /store/payment-links/:token/cart` with `{}`: a fresh cart, locked to the link. */
export interface StorePaymentLinkCart {
  cart_id: string
}
