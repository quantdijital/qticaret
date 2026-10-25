import type { Lifecycle } from "@/features/dashboard/api/overview"

/**
 * When each step of an order's way happened, for the order page's progress
 * line. The stage itself comes from the server (`/admin/order-board/:id`);
 * this only dates the steps from the order read. Pure, so tested on its own.
 */

type When = string | Date | null | undefined

export interface MilestoneFacts {
  created_at?: When
  fulfillments?: ({ shipped_at?: When; delivered_at?: When; canceled_at?: When } | null)[] | null
  payment_collections?:
    | ({
        status?: string | null
        payments?: ({ captured_at?: When; canceled_at?: When } | null)[] | null
      } | null)[]
    | null
}

const present = <T>(rows: (T | null)[] | null | undefined): T[] =>
  (rows ?? []).filter((row): row is T => row !== null)

const iso = (values: When[]): string[] =>
  values
    .filter((when): when is string | Date => Boolean(when))
    .map((when) => new Date(when).toISOString())

const earliest = (values: When[]) => iso(values).sort()[0] ?? null
const latest = (values: When[]) => iso(values).sort().at(-1) ?? null

export function milestones(order: MilestoneFacts, stage: Lifecycle) {
  const parcels = present(order.fulfillments).filter((row) => !row.canceled_at)
  const payments = present(order.payment_collections).flatMap((row) => present(row.payments))
  const placed = order.created_at ? new Date(order.created_at).toISOString() : null
  const captured = earliest(
    payments.filter((row) => !row.canceled_at).map((row) => row.captured_at)
  )
  const paidStage = stage === "to_ship" || stage === "shipped" || stage === "delivered"
  return {
    placed,
    // Held but not yet taken still lets the shop send: dated from the order then
    paid: captured ?? (paidStage ? placed : null),
    shipped: earliest(parcels.map((row) => row.shipped_at)),
    delivered: stage === "delivered" ? latest(parcels.map((row) => row.delivered_at)) : null,
  }
}
