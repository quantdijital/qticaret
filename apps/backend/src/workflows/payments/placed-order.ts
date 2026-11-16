import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The order a paid cart already became (finding 2026-11-16: a repeated or
 * late notice must never read a placed order's cart as money to give back).
 */
export interface PlacedOrder {
  /** Null: the cart is marked completed, yet no order is linked to it (still never "no order"). */
  order_id: string | null
  /** The payment sessions whose payments the order's collection holds. */
  session_ids: string[]
  /** Those payments' provider references (PayTR's `merchant_oid`, iyzico's `payment_id`). */
  references: string[]
}

interface CartRow {
  completed_at?: unknown
  order?: { id?: string | null } | null
  payment_collection?: {
    payments?:
      | ({ payment_session_id?: string | null; data?: Record<string, unknown> | null } | null)[]
      | null
  } | null
}

// Where each provider's reference sits in a payment's data (as `statement-payments.ts` reads it)
const REFERENCE_KEYS = ["merchant_oid", "payment_id"] as const

const fieldOf = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined

/** A cart row's placed order; null only when the cart has no order and is not completed. */
export function placedOrderOf(row: CartRow | undefined): PlacedOrder | null {
  if (!row || (!row.order?.id && !row.completed_at)) {
    return null
  }
  const payments = (row.payment_collection?.payments ?? []).flatMap((payment) =>
    payment ? [payment] : []
  )
  return {
    order_id: row.order?.id ?? null,
    session_ids: payments.flatMap((payment) =>
      typeof payment.payment_session_id === "string" ? [payment.payment_session_id] : []
    ),
    references: payments.flatMap((payment) =>
      REFERENCE_KEYS.flatMap((key) => {
        const value = payment.data?.[key]
        return typeof value === "string" && value !== "" ? [value] : []
      })
    ),
  }
}

/** The order the cart already became, if any. A failed read throws: never taken as "no order". */
export async function placedOrderOfCart(
  container: Container,
  cartId: string
): Promise<PlacedOrder | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: [
      "completed_at",
      "order.id",
      "payment_collection.payments.payment_session_id",
      "payment_collection.payments.data",
    ],
    filters: { id: cartId },
  })
  return placedOrderOf(data[0] as CartRow | undefined)
}

/**
 * Whether the order holds the notice's payment (review N2): its session is
 * one the order's payments came from.
 */
export const holdsSession = (placed: PlacedOrder, sessionId: string): boolean =>
  placed.session_ids.includes(sessionId)

/** Our payment session behind PayTR's reference (`payses01…` → `payses_01…`); null if not ours. */
export const paytrSessionIdOf = (merchantOid: string): string | null =>
  /^payses[0-9A-Z]{20,40}$/.test(merchantOid)
    ? `payses_${merchantOid.slice("payses".length)}`
    : null

/** The placed order a payment session's payment belongs to; null when none. Throws when unread. */
export async function orderOfSession(
  container: Container,
  sessionId: string
): Promise<string | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "payment",
    fields: ["payment_collection.order.id"],
    filters: { payment_session_id: sessionId },
  })
  for (const row of data) {
    const orderId = fieldOf(fieldOf(fieldOf(row, "payment_collection"), "order"), "id")
    if (typeof orderId === "string" && orderId !== "") {
      return orderId
    }
  }
  return null
}
