import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { LIFECYCLE_FIELDS, boardSlice } from "../../../lib/dashboard"
import type { LifecycleOrder } from "../../../lib/dashboard"
import { createSingleFlight } from "../../../lib/cache"
import { fromMedusaAmount, toMedusaAmount } from "../../../lib/money"
import type { MedusaAmount } from "../../../lib/money"
import { carrierOf } from "../../../lib/shipping/carriers"
import type { CarrierName } from "../../../lib/shipping/carriers"
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
  shipping_methods?: ({ name?: string | null; shipping_option_id?: string | null } | null)[] | null
}

interface Parcel {
  status: ShipmentStatus
  tracking_number: string | null
  /** The parcel's fulfillment: its label, while it waits for the carrier. */
  fulfillment_id: string
}

/** How the shopper chose the order to go: the option's name and who carries it. */
interface Delivery {
  name: string
  /** A carrier that issues a label; null: the shop's own delivery or collection. */
  carrier: CarrierName | null
  pickup: boolean
}

/** Each order's chosen delivery, from its shipping method's option (F7.7). */
async function deliveriesOf(
  scope: MedusaContainer,
  orders: readonly DisplayRow[]
): Promise<Map<string, Delivery>> {
  const methods = new Map(
    orders.flatMap((order) => {
      const method = (order.shipping_methods ?? []).find((each) => each?.name)
      return method?.name
        ? [[order.id, { name: method.name, option: method.shipping_option_id ?? null }] as const]
        : []
    })
  )
  const optionIds = [
    ...new Set([...methods.values()].flatMap(({ option }) => (option ? [option] : []))),
  ]
  const { data } = optionIds.length
    ? await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "shipping_option",
        fields: ["id", "provider_id", "service_zone.fulfillment_set.type"],
        filters: { id: optionIds },
      })
    : { data: [] }
  const options = new Map(
    (
      data as {
        id: string
        provider_id?: string | null
        service_zone?: { fulfillment_set?: { type?: string | null } | null } | null
      }[]
    ).map((option) => [option.id, option])
  )
  return new Map(
    [...methods].map(([orderId, method]) => {
      const option = method.option ? options.get(method.option) : undefined
      return [
        orderId,
        {
          name: method.name,
          carrier: carrierOf(option?.provider_id),
          pickup: option?.service_zone?.fulfillment_set?.type === "pickup",
        },
      ]
    })
  )
}

/** Each order's latest carrier parcel (F7.7, adr/0031): where it stands and its tracking number. */
async function shippingOf(
  scope: MedusaContainer,
  orderIds: string[]
): Promise<Map<string, Parcel>> {
  if (orderIds.length === 0) {
    return new Map()
  }
  const parcels = await scope
    .resolve<ShipmentTrackingModuleService>(SHIPMENT_TRACKING_MODULE)
    .listTrackedShipments(
      { order_id: orderIds, status: { $ne: "canceled" } },
      {
        select: ["order_id", "status", "tracking_number", "fulfillment_id"],
        order: { created_at: "DESC" },
      }
    )
  const latest = new Map<string, Parcel>()
  for (const parcel of parcels) {
    if (!latest.has(parcel.order_id)) {
      latest.set(parcel.order_id, {
        status: parcel.status,
        tracking_number: parcel.tracking_number,
        fulfillment_id: parcel.fulfillment_id,
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
          "shipping_methods.name",
          "shipping_methods.shipping_option_id",
        ],
        filters: { id: ids },
      })
    : { data: [] }
  const byId = new Map((full as unknown as DisplayRow[]).map((order) => [order.id, order]))
  const [shipping, deliveries] = await Promise.all([
    shippingOf(scope, ids),
    deliveriesOf(scope, full as unknown as DisplayRow[]),
  ])
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
              delivery: deliveries.get(id) ?? null,
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
