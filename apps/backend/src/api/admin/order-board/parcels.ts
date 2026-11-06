import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { carrierOf } from "../../../lib/shipping/carriers"
import type { CarrierName } from "../../../lib/shipping/carriers"
import { SHIPMENT_TRACKING_MODULE } from "../../../modules/shipment-tracking"
import type ShipmentTrackingModuleService from "../../../modules/shipment-tracking/service"
import type { ShipmentStatus } from "../../../modules/shipment-tracking/states"

export interface Parcel {
  status: ShipmentStatus
  tracking_number: string | null
  /** The parcel's fulfillment: its label, while it waits for the carrier. */
  fulfillment_id: string
}

/** How the shopper chose the order to go: the option's name and who carries it. */
export interface Delivery {
  name: string
  /** A carrier that issues a label; null: the shop's own delivery or collection. */
  carrier: CarrierName | null
  pickup: boolean
}

export interface ShippingMethodRow {
  name?: string | null
  shipping_option_id?: string | null
}

export interface DeliveryOrder {
  id: string
  shipping_methods?: (ShippingMethodRow | null)[] | null
}

interface OptionRow {
  id: string
  provider_id?: string | null
  service_zone?: { fulfillment_set?: { type?: string | null } | null } | null
}

/** The order's chosen shipping method: the first with a name. */
const methodOf = (order: DeliveryOrder) =>
  (order.shipping_methods ?? []).find((each) => each?.name) ?? null

/** Each order's chosen delivery, from its shipping method's option (F7.7). */
export async function deliveriesOf(
  scope: MedusaContainer,
  orders: readonly DeliveryOrder[]
): Promise<Map<string, Delivery>> {
  const methods = new Map(
    orders.flatMap((order) => {
      const method = methodOf(order)
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
  const options = new Map((data as OptionRow[]).map((option) => [option.id, option]))
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
export async function shippingOf(
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
