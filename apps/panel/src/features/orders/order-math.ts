/**
 * What the order page works out from the order it read: its stage, what
 * is left to ship, deliver or collect. The stage follows the server's
 * rule (lib/dashboard/lifecycle) on whole fulfillments; pure, so tested
 * on its own.
 */

type When = string | Date | null | undefined

export interface OrderFacts {
  status: string
  items?:
    | ({
        id: string
        quantity: number
        detail?: { fulfilled_quantity?: number | null } | null
      } | null)[]
    | null
  fulfillments?:
    | ({
        id: string
        created_at?: When
        shipped_at?: When
        delivered_at?: When
        canceled_at?: When
      } | null)[]
    | null
  payment_collections?:
    | ({
        status?: string | null
        payments?: ({ id: string; captured_at?: When; canceled_at?: When } | null)[] | null
      } | null)[]
    | null
}

export type OrderLifecycle = "awaiting_payment" | "to_ship" | "shipped" | "delivered" | "canceled"

const present = <T>(rows: (T | null)[] | null | undefined): T[] =>
  (rows ?? []).filter((row): row is T => row !== null)

const activeFulfillments = (order: OrderFacts) =>
  present(order.fulfillments).filter((row) => !row.canceled_at)

const payments = (order: OrderFacts) =>
  present(order.payment_collections).flatMap((row) => present(row.payments))

/** Payment taken, or held by the provider to take later: the order is the shop's to send. */
export function isPaid(order: OrderFacts): boolean {
  return (
    payments(order).some((payment) => payment.captured_at && !payment.canceled_at) ||
    present(order.payment_collections).some((row) =>
      ["authorized", "partially_authorized", "completed"].includes(row.status ?? "")
    )
  )
}

/** Items (with how many) not yet in a parcel. */
export function unshippedItems(order: OrderFacts): { id: string; quantity: number }[] {
  return present(order.items).flatMap((item) => {
    const left = item.quantity - (item.detail?.fulfilled_quantity ?? 0)
    return left > 0 ? [{ id: item.id, quantity: left }] : []
  })
}

/** Parcels on their way: handed over, not yet delivered. */
export function inTransit(order: OrderFacts): string[] {
  return activeFulfillments(order)
    .filter((row) => row.shipped_at && !row.delivered_at)
    .map((row) => row.id)
}

/** Payments held but not yet taken. */
export function uncaptured(order: OrderFacts): string[] {
  return payments(order)
    .filter((payment) => !payment.captured_at && !payment.canceled_at)
    .map((payment) => payment.id)
}

export function lifecycleOf(order: OrderFacts): OrderLifecycle {
  if (order.status === "canceled") {
    return "canceled"
  }
  const parcels = activeFulfillments(order)
  if (
    parcels.length > 0 &&
    unshippedItems(order).length === 0 &&
    parcels.every((row) => row.delivered_at)
  ) {
    return "delivered"
  }
  if (parcels.some((row) => row.shipped_at)) {
    return "shipped"
  }
  return isPaid(order) ? "to_ship" : "awaiting_payment"
}

/** When each step of the order's way happened, for the progress line. */
export function milestones(order: OrderFacts & { created_at?: When }) {
  const parcels = activeFulfillments(order)
  const first = (pick: (row: (typeof parcels)[number]) => When) =>
    parcels
      .map(pick)
      .filter((when): when is string | Date => Boolean(when))
      .map((when) => new Date(when).toISOString())
      .sort()[0] ?? null
  const captured = payments(order)
    .map((payment) => payment.captured_at)
    .filter((when): when is string | Date => Boolean(when))
    .map((when) => new Date(when).toISOString())
    .sort()[0]
  return {
    placed: order.created_at ? new Date(order.created_at).toISOString() : null,
    paid:
      captured ??
      (isPaid(order) ? (order.created_at ? new Date(order.created_at).toISOString() : null) : null),
    shipped: first((row) => row.shipped_at),
    delivered: lifecycleOf(order) === "delivered" ? first((row) => row.delivered_at) : null,
  }
}
