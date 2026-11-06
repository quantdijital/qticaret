import { methodOf } from "../reports/finance"

/**
 * How an order was paid, as the shop names it on its order list, its
 * packing slips and its export: by card (PayTR, iyzico), by bank transfer,
 * at the door, or through a payment link staff sent (adr/0051), whatever
 * the link was then paid with. A gift card paying all of it, or a provider
 * the shop has none of (the system's own in tests), is neither.
 */
export const PAYMENT_METHODS = ["card", "bank_transfer", "cod", "payment_link"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number] | "gift_card" | "other"

/** The order's metadata key naming the payment link it was paid through (adr/0051). */
const LINK_KEY = "qt_payment_link"

const BY_PROVIDER: Readonly<Record<string, PaymentMethod>> = {
  paytr: "card",
  iyzico: "card",
  "bank-transfer": "bank_transfer",
  cod: "cod",
  "gift-card": "gift_card",
}

/** What the method is read from; one read of the order list asks for these. */
export const PAYMENT_METHOD_FIELDS = [
  "metadata",
  "payment_collections.payments.provider_id",
  "payment_collections.payment_sessions.provider_id",
  "payment_collections.payment_sessions.status",
]

type Rows<T> = (T | null)[] | null | undefined

export interface PaymentMethodOrder {
  metadata?: Record<string, unknown> | null
  payment_collections?: Rows<{
    payments?: Rows<{ provider_id?: string | null }>
    payment_sessions?: Rows<{ provider_id?: string | null; status?: string | null }>
  }>
}

const present = <T>(rows: Rows<T>): T[] => (rows ?? []).filter((row): row is T => row !== null)

// A session the shopper left for another way to pay says nothing
const CHOSEN_SESSIONS = new Set(["authorized", "captured", "pending", "requires_more"])

/**
 * The order's payment method: a link's order is the link's; otherwise the
 * provider of its payments, a card or transfer before a gift card that paid
 * part; with no payment yet (a transfer not yet authorized), the session
 * the shopper chose.
 */
export function paymentMethodOf(order: PaymentMethodOrder): PaymentMethod {
  const link = order.metadata?.[LINK_KEY]
  if (typeof link === "string" && link !== "") {
    return "payment_link"
  }
  const collections = present(order.payment_collections)
  const paid = collections.flatMap((collection) =>
    present(collection.payments).map((payment) => payment.provider_id)
  )
  const chosen = collections.flatMap((collection) =>
    present(collection.payment_sessions)
      .filter((session) => CHOSEN_SESSIONS.has(session.status ?? ""))
      .map((session) => session.provider_id)
  )
  const methods = (paid.length > 0 ? paid : chosen).map(
    (provider) => BY_PROVIDER[methodOf(provider)] ?? "other"
  )
  return (
    methods.find((method) => method !== "gift_card" && method !== "other") ??
    methods.find((method) => method === "gift_card") ??
    "other"
  )
}
