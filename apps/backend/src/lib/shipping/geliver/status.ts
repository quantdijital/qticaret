import type { ShipmentStatus } from "../../../modules/shipment-tracking/states"
import type { GeliverShipment } from "./schemas"

/**
 * A Geliver shipment's place on the parcel's way (adr/0031). Geliver's
 * shipment status is documented (the SDK's list filter); its tracking
 * codes are not, so they only fill in what the status leaves open
 * (`TRANSIT` once the carrier has it). To be checked with a real account.
 */

const BY_STATUS: Readonly<Record<string, ShipmentStatus>> = {
  SHIPPED: "in_transit",
  DELIVERED: "delivered",
  RETURNED: "returned",
  RETURN_SHIPPED: "returned",
  FAILED: "failed",
  CANCELED: "canceled",
}

const BY_TRACKING: Readonly<Record<string, ShipmentStatus>> = {
  TRANSIT: "in_transit",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  RETURNED: "returned",
  FAILURE: "failed",
}

export function geliverStatusOf(shipment: GeliverShipment): {
  status: ShipmentStatus
  provider_status: string | null
} {
  const code = shipment.statusCode ?? null
  const tracking = shipment.trackingStatus?.trackingStatusCode ?? null
  const status =
    (code ? BY_STATUS[code] : undefined) ??
    (tracking ? BY_TRACKING[tracking] : undefined) ??
    "created"
  return { status, provider_status: [code, tracking].filter(Boolean).join("/") || null }
}
