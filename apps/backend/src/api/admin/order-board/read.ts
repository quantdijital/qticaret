import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LIFECYCLE_FIELDS, boardSlice } from "../../../lib/dashboard"
import type { LifecycleOrder } from "../../../lib/dashboard"
import { createSingleFlight } from "../../../lib/cache"
import { fromMedusaAmount, toMedusaAmount } from "../../../lib/money"
import type { MedusaAmount } from "../../../lib/money"
import { SHIPMENT_TRACKING_MODULE } from "../../../modules/shipment-tracking"
import type ShipmentTrackingModuleService from "../../../modules/shipment-tracking/service"
import type { ShipmentStatus } from "../../../modules/shipment-tracking/states"
import { MAX_ORDERS_READ, NOT_ORDERS } from "../dashboard/orders"
import { ORDER_BOARD_PAGE } from "./validators"
import type { AdminGetOrderBoardType } from "./validators"

// Tabs and pages asked at once share one read of the stages (docs/04)
const stageRead = createSingleFlight<{
  data: unknown[]
  metadata?: { count?: number } | undefined
}>()

interface StageRow extends LifecycleOrder {
  id: string
}

interface DisplayRow extends LifecycleOrder {
  id: string
  display_id: number | string
  created_at: string | Date
  total: MedusaAmount
  items?: ({ quantity?: number | null } | null)[] | null
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
    city?: string | null
    province?: string | null
  } | null
}

/** Each order's latest carrier parcel (F7.7, adr/0031): where it stands and its tracking number. */
async function shippingOf(
  scope: MedusaContainer,
  orderIds: string[]
): Promise<Map<string, { status: ShipmentStatus; tracking_number: string | null }>> {
  if (orderIds.length === 0) {
    return new Map()
  }
  const parcels = await scope
    .resolve<ShipmentTrackingModuleService>(SHIPMENT_TRACKING_MODULE)
    .listTrackedShipments(
      { order_id: orderIds, status: { $ne: "canceled" } },
      { select: ["order_id", "status", "tracking_number"], order: { created_at: "DESC" } }
    )
  const latest = new Map<string, { status: ShipmentStatus; tracking_number: string | null }>()
  for (const parcel of parcels) {
    if (!latest.has(parcel.order_id)) {
      latest.set(parcel.order_id, {
        status: parcel.status,
        tracking_number: parcel.tracking_number,
      })
    }
  }
  return latest
}

const customerOf = (address: DisplayRow["shipping_address"]) => ({
  name: [address?.first_name, address?.last_name].filter(Boolean).join(" ") || null,
  place: address?.province ?? address?.city ?? null,
})

/**
 * The order list by stage (adr/0022). Stages come from payment and
 * shipment records the database cannot filter on, so the newest
 * MAX_ORDERS_READ orders are sorted here (`limited` says when there were
 * more); only the page's orders are then read in full.
 */
export async function readOrderBoard(scope: MedusaContainer, params: AdminGetOrderBoardType) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data, metadata } = await stageRead(`${params.customer_id ?? ""}|${params.q ?? ""}`, () =>
    query.graph({
      entity: "order",
      fields: ["id", ...LIFECYCLE_FIELDS],
      filters: {
        status: { $nin: NOT_ORDERS },
        is_draft_order: false,
        ...(params.q ? { q: params.q } : {}),
        ...(params.customer_id ? { customer_id: params.customer_id } : {}),
      },
      pagination: { skip: 0, take: MAX_ORDERS_READ, order: { created_at: "DESC" } },
    })
  )
  const rows = data as unknown as StageRow[]
  const slice = boardSlice(rows, params.stage, params.offset, ORDER_BOARD_PAGE)
  const ids = slice.page.map((row) => row.id)
  const { data: full } = ids.length
    ? await query.graph({
        entity: "order",
        fields: [
          "id",
          "display_id",
          "created_at",
          "total",
          ...LIFECYCLE_FIELDS,
          "items.quantity",
          "shipping_address.first_name",
          "shipping_address.last_name",
          "shipping_address.city",
          "shipping_address.province",
        ],
        filters: { id: ids },
      })
    : { data: [] }
  const byId = new Map((full as unknown as DisplayRow[]).map((order) => [order.id, order]))
  const shipping = await shippingOf(scope, ids)
  return {
    orders: slice.page.flatMap(({ id, stage }) => {
      const order = byId.get(id)
      return order
        ? [
            {
              id,
              display_id: Number(order.display_id),
              created_at: new Date(order.created_at).toISOString(),
              currency_code: order.currency_code,
              total: toMedusaAmount(fromMedusaAmount(order.total, { allowRounding: true })),
              items: (order.items ?? []).reduce((sum, item) => sum + (item?.quantity ?? 0), 0),
              stage,
              customer: customerOf(order.shipping_address),
              shipping: shipping.get(id) ?? null,
            },
          ]
        : []
    }),
    count: slice.count,
    counts: slice.counts,
    offset: params.offset,
    limit: ORDER_BOARD_PAGE,
    limited: (metadata?.count ?? rows.length) > rows.length,
  }
}

export type OrderBoard = Awaited<ReturnType<typeof readOrderBoard>>
