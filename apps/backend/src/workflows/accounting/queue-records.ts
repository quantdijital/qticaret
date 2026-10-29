import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { paidInTestMode } from "../../lib/payments/test-mode"
import type { SyncSource } from "../../modules/accounting/service"

export type Records = { source_type: SyncSource; source_id: string }[]

const PAGE = 500

interface OrderRow {
  id: string
  payment_collections?:
    | ({
        payments?: ({ data?: unknown; captures?: ({ id: string } | null)[] | null } | null)[] | null
      } | null)[]
    | null
}

interface Move {
  id: string
  payment?: { data?: Record<string, unknown> | null } | null
}

const capturesOf = (order: OrderRow): Records =>
  (order.payment_collections ?? []).flatMap((collection) =>
    (collection?.payments ?? []).flatMap((payment) =>
      (payment?.captures ?? []).flatMap((capture) =>
        capture ? [{ source_type: "payment" as const, source_id: capture.id }] : []
      )
    )
  )

/**
 * What an event sends: the order (its sale, and what its card payment took
 * as it was authorized: Medusa records that capture without a
 * `payment.captured` event), a canceled order's cancellation, or each
 * capture or refund of a payment. Nothing paid in test mode.
 */
export async function recordsOfEvent(
  container: MedusaContainer,
  event: string,
  id: string
): Promise<Records> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  if (event === "order.placed" || event === "order.canceled") {
    const { data } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "payment_collections.payments.data",
        "payment_collections.payments.captures.id",
      ],
      filters: { id },
    })
    const order = data[0] as OrderRow | undefined
    if (!order || paidInTestMode(order)) {
      return []
    }
    return event === "order.canceled"
      ? [{ source_type: "cancel", source_id: id }]
      : [{ source_type: "sale", source_id: id }, ...capturesOf(order)]
  }
  const { data } = await query.graph({
    entity: "payment",
    fields: ["id", "data", "captures.id", "refunds.id"],
    filters: { id },
  })
  const payment = data[0] as
    | {
        data?: Record<string, unknown> | null
        captures?: ({ id: string } | null)[] | null
        refunds?: ({ id: string } | null)[] | null
      }
    | undefined
  if (!payment || payment.data?.["test_mode"] === true) {
    return []
  }
  const [type, moves] =
    event === "payment.captured"
      ? (["payment", payment.captures] as const)
      : (["refund", payment.refunds] as const)
  return (moves ?? []).flatMap((move) => (move ? [{ source_type: type, source_id: move.id }] : []))
}

async function ordersBetween(
  container: MedusaContainer,
  field: "created_at" | "canceled_at",
  from: Date,
  to: Date
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orders: OrderRow[] = []
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "payment_collections.payments.data"],
      filters: { [field]: { $gte: from.toISOString(), $lt: to.toISOString() } },
      pagination: { skip, take: PAGE, order: { id: "ASC" } },
    })
    orders.push(...(data as OrderRow[]))
    if (data.length < PAGE) {
      return orders.filter((order) => !paidInTestMode(order))
    }
  }
}

async function movesBetween(container: MedusaContainer, from: Date, to: Date): Promise<Records> {
  const payments = container.resolve(Modules.PAYMENT)
  const window = { created_at: { $gte: from.toISOString(), $lt: to.toISOString() } }
  const records: Records = []
  for (const [type, list] of [
    [
      "payment",
      (skip: number) =>
        payments.listCaptures(window, {
          relations: ["payment"],
          take: PAGE,
          skip,
          order: { id: "ASC" },
        }),
    ],
    [
      "refund",
      (skip: number) =>
        payments.listRefunds(window, {
          relations: ["payment"],
          take: PAGE,
          skip,
          order: { id: "ASC" },
        }),
    ],
  ] as const) {
    for (let skip = 0; ; skip += PAGE) {
      const rows = (await list(skip)) as unknown as Move[]
      for (const row of rows) {
        if (row.payment?.data?.["test_mode"] !== true) {
          records.push({ source_type: type, source_id: row.id })
        }
      }
      if (rows.length < PAGE) {
        break
      }
    }
  }
  return records
}

/**
 * Every record of `[from, to)`: orders placed and canceled, money taken
 * and given back. Queuing them again leaves those already queued alone, so
 * a sweep catches what an event missed (a failed insert, a capture made
 * with no event) and nothing twice.
 */
export async function recordsBetween(
  container: MedusaContainer,
  from: Date,
  to: Date
): Promise<Records> {
  const placed = await ordersBetween(container, "created_at", from, to)
  const canceled = await ordersBetween(container, "canceled_at", from, to)
  return [
    ...placed.map((order) => ({ source_type: "sale" as const, source_id: order.id })),
    ...canceled.map((order) => ({ source_type: "cancel" as const, source_id: order.id })),
    ...(await movesBetween(container, from, to)),
  ]
}
