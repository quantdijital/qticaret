import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LIFECYCLE_FIELDS, lifecycleOf, turkishDayStart } from "../../../lib/dashboard"
import { oneOf, paymentFilterOf, shippingFilterOf } from "../../../lib/dashboard/board-filters"
import type { LifecycleOrder } from "../../../lib/dashboard"
import { createSingleFlight } from "../../../lib/cache"
import { PAYMENT_METHOD_FIELDS, paymentMethodOf } from "../../../lib/orders/payment-method"
import type { PaymentMethodOrder } from "../../../lib/orders/payment-method"
import { wholesaleOrders } from "../../../workflows/wholesale/orders"
import { MAX_ORDERS_READ, NOT_ORDERS } from "../dashboard/orders"
import { deliveriesOf, shippingOf } from "./parcels"
import type { DeliveryOrder } from "./parcels"
import type { OrderFilters } from "./validators"

const DAY_MS = 24 * 60 * 60 * 1000

// Tabs and pages asked at once share one read of the stages (docs/04)
const stageRead = createSingleFlight<{
  data: unknown[]
  metadata?: { count?: number } | undefined
}>()

export type StageRow = LifecycleOrder & PaymentMethodOrder & DeliveryOrder & { id: string }

/** The days asked, as instants: from the first's midnight to the last's end (Turkey). */
function createdWithin(filters: Pick<OrderFilters, "from" | "to">) {
  const from = filters.from ? turkishDayStart(filters.from) : null
  const last = filters.to ? turkishDayStart(filters.to) : null
  if (!from && !last) {
    return {}
  }
  return {
    created_at: {
      ...(from ? { $gte: from } : {}),
      ...(last ? { $lt: new Date(last.getTime() + DAY_MS) } : {}),
    },
  }
}

/**
 * The orders where the money, the method, the carrier and the parcel stand
 * as asked (F12.3; any of a filter's choices), before the stages are counted: the tabs count what the
 * filters leave. Options and parcels are read only when their filter asks.
 */
async function filtered(
  scope: MedusaContainer,
  rows: StageRow[],
  filters: OrderFilters
): Promise<StageRow[]> {
  let kept = rows
  if (filters.payment) {
    kept = kept.filter((row) => oneOf(filters.payment, paymentFilterOf(row)))
  }
  if (filters.method) {
    kept = kept.filter((row) => oneOf(filters.method, paymentMethodOf(row)))
  }
  if (filters.carrier) {
    const deliveries = await deliveriesOf(scope, kept)
    kept = kept.filter((row) => {
      const delivery = deliveries.get(row.id)
      return delivery ? oneOf(filters.carrier, delivery.carrier ?? "own") : false
    })
  }
  if (filters.shipping) {
    const parcels = await shippingOf(
      scope,
      kept.map((row) => row.id)
    )
    kept = kept.filter((row) =>
      oneOf(
        filters.shipping,
        shippingFilterOf(lifecycleOf(row), parcels.get(row.id)?.status ?? null)
      )
    )
  }
  return kept
}

/**
 * The wholesale orders a wholesale list reads (one wholesaler's, or all);
 * null for a list that is not one (ADR-0068 Ek 2026-11-15 (2)).
 */
async function wholesaleScope(
  scope: MedusaContainer,
  filters: OrderFilters
): Promise<string[] | null> {
  if (filters.segment !== "wholesale") {
    return null
  }
  const linked = await wholesaleOrders(
    scope,
    filters.wholesaler ? { account_id: filters.wholesaler } : {}
  )
  return [...linked.keys()]
}

/**
 * The orders the list's filters leave, newest first (adr/0022). Stages
 * come from payment and shipment records the database cannot filter on,
 * so the newest MAX_ORDERS_READ orders the search and the days leave are
 * read and sorted here; `limited` says when there were more. The retail
 * list leaves wholesale orders out before anything is counted (ADR-0068
 * Ek 2026-11-15 (2)); `wholesale_matches` says how many it left out of a
 * search, so staff are told where to look.
 */
export async function boardRows(
  scope: MedusaContainer,
  filters: OrderFilters
): Promise<{ rows: StageRow[]; limited: boolean; wholesale_matches: number }> {
  const only = await wholesaleScope(scope, filters)
  if (only !== null && only.length === 0) {
    return { rows: [], limited: false, wholesale_matches: 0 }
  }
  const fields = [
    "id",
    ...LIFECYCLE_FIELDS,
    ...(filters.method ? PAYMENT_METHOD_FIELDS : []),
    ...(filters.carrier ? ["shipping_methods.name", "shipping_methods.shipping_option_id"] : []),
  ]
  const key = [
    filters.customer_id ?? "",
    filters.q ?? "",
    filters.from ?? "",
    filters.to ?? "",
    filters.method ? "m" : "",
    filters.carrier ? "c" : "",
    filters.segment,
    filters.wholesaler ?? "",
    // A new wholesale order changes the wholesale list's ids
    only ? String(only.length) : "",
  ].join("|")
  const { data, metadata } = await stageRead(key, () =>
    scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields,
      filters: {
        status: { $nin: NOT_ORDERS },
        is_draft_order: false,
        ...(filters.q ? { q: filters.q } : {}),
        ...(filters.customer_id ? { customer_id: filters.customer_id } : {}),
        ...(only ? { id: only } : {}),
        ...createdWithin(filters),
      },
      pagination: { skip: 0, take: MAX_ORDERS_READ, order: { created_at: "DESC" } },
    })
  )
  const read = data as unknown as StageRow[]
  let kept = read
  let wholesaleMatches = 0
  if (filters.segment === "retail") {
    const linked = await wholesaleOrders(scope, { order_ids: read.map((row) => row.id) })
    kept = read.filter((row) => !linked.has(row.id))
    wholesaleMatches = filters.q ? read.length - kept.length : 0
  }
  return {
    rows: await filtered(scope, kept, filters),
    limited: (metadata?.count ?? data.length) > data.length,
    wholesale_matches: wholesaleMatches,
  }
}
