import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { carrierNameOf, trackingUrlOf } from "../../lib/shipping/carriers"
import { SHIPMENT_TRACKING_MODULE } from "../../modules/shipment-tracking"
import type ShipmentTrackingModuleService from "../../modules/shipment-tracking/service"

interface FulfillmentRow {
  id: string
  provider_id: string | null
  data: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  shipped_at: string | Date | null
  delivered_at: string | Date | null
  canceled_at: string | Date | null
  labels: ({ tracking_number?: string | null; tracking_url?: string | null } | null)[] | null
  items: ({ title?: string | null; quantity: unknown } | null)[] | null
}

/** A parcel as the shopper's order page shows it. */
export interface OrderShipment {
  id: string
  carrier: string | null
  tracking_number: string | null
  tracking_url: string | null
  shipped_at: string | null
  delivered_at: string | null
  /** The carrier's last word on it (`created` … `delivered`), when it is followed. */
  status: string | null
  status_at: string | null
  items: { title: string; quantity: number }[]
}

const iso = (value: string | Date | null | undefined): string | null =>
  value ? new Date(value).toISOString() : null

/**
 * The order's parcels that left the shop (F18, the order page): carrier,
 * tracking number and link, when it left and arrived, and the carrier's
 * last status. Nothing of the provider's own data beyond the carrier's
 * name; cancelled or not yet handed over parcels are not shown.
 */
export async function orderShipments(
  container: Pick<MedusaContainer, "resolve">,
  orderId: string
): Promise<OrderShipment[]> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      "fulfillments.id",
      "fulfillments.provider_id",
      "fulfillments.data",
      "fulfillments.metadata",
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
      "fulfillments.canceled_at",
      "fulfillments.labels.tracking_number",
      "fulfillments.labels.tracking_url",
      "fulfillments.items.title",
      "fulfillments.items.quantity",
    ],
    filters: { id: orderId },
  })
  const fulfillments = (
    (data[0] as { fulfillments?: (FulfillmentRow | null)[] } | undefined)?.fulfillments ?? []
  ).filter((row): row is FulfillmentRow => row !== null && !row.canceled_at && !!row.shipped_at)
  if (fulfillments.length === 0) {
    return []
  }
  const tracked = await container
    .resolve<ShipmentTrackingModuleService>(SHIPMENT_TRACKING_MODULE)
    .listTrackedShipments(
      { fulfillment_id: fulfillments.map((row) => row.id) },
      { select: ["fulfillment_id", "tracking_number", "tracking_url", "status", "status_at"] }
    )
  const byFulfillment = new Map(tracked.map((row) => [row.fulfillment_id, row]))
  return fulfillments
    .map((row) => {
      const label = (row.labels ?? []).find((each) => each?.tracking_number)
      const follow = byFulfillment.get(row.id)
      return {
        id: row.id,
        carrier: carrierNameOf(row.provider_id, row.data, row.metadata),
        tracking_number: label?.tracking_number ?? follow?.tracking_number ?? null,
        tracking_url: trackingUrlOf(label?.tracking_url ?? follow?.tracking_url),
        shipped_at: iso(row.shipped_at),
        delivered_at: iso(row.delivered_at),
        status: follow?.status ?? null,
        status_at: iso(follow?.status_at),
        items: (row.items ?? []).flatMap((item) =>
          item ? [{ title: item.title ?? "", quantity: Number(item.quantity) }] : []
        ),
      }
    })
    .sort((a, b) => (a.shipped_at ?? "").localeCompare(b.shipped_at ?? ""))
}
