import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LIFECYCLE_FIELDS, lifecycleOf, turkishDayStart } from "../../../lib/dashboard"
import { paymentFilterOf, shippingFilterOf } from "../../../lib/dashboard/board-filters"
import type { LifecycleOrder } from "../../../lib/dashboard"
import { createSingleFlight } from "../../../lib/cache"
import { PAYMENT_METHOD_FIELDS, paymentMethodOf } from "../../../lib/orders/payment-method"
import type { PaymentMethodOrder } from "../../../lib/orders/payment-method"
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
 * as asked (F12.3), before the stages are counted: the tabs count what the
 * filters leave. Options and parcels are read only when their filter asks.
 */
async function filtered(
  scope: MedusaContainer,
  rows: StageRow[],
  filters: OrderFilters
): Promise<StageRow[]> {
  let kept = rows
  if (filters.payment) {
    kept = kept.filter((row) => paymentFilterOf(row) === filters.payment)
  }
  if (filters.method) {
    kept = kept.filter((row) => paymentMethodOf(row) === filters.method)
  }
  if (filters.carrier) {
    const deliveries = await deliveriesOf(scope, kept)
    kept = kept.filter((row) => {
      const delivery = deliveries.get(row.id)
      return delivery ? (delivery.carrier ?? "own") === filters.carrier : false
    })
  }
  if (filters.shipping) {
    const parcels = await shippingOf(
      scope,
      kept.map((row) => row.id)
    )
    kept = kept.filter(
      (row) =>
        shippingFilterOf(lifecycleOf(row), parcels.get(row.id)?.status ?? null) === filters.shipping
    )
  }
  return kept
}

/**
 * The orders the list's filters leave, newest first (adr/0022). Stages
 * come from payment and shipment records the database cannot filter on,
 * so the newest MAX_ORDERS_READ orders the search and the days leave are
 * read and sorted here; `limited` says when there were more.
 */
export async function boardRows(
  scope: MedusaContainer,
  filters: OrderFilters
): Promise<{ rows: StageRow[]; limited: boolean }> {
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
        ...createdWithin(filters),
      },
      pagination: { skip: 0, take: MAX_ORDERS_READ, order: { created_at: "DESC" } },
    })
  )
  return {
    rows: await filtered(scope, data as unknown as StageRow[], filters),
    limited: (metadata?.count ?? data.length) > data.length,
  }
}
