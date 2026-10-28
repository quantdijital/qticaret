import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../../lib/logging"
import { SHIPMENT_TRACKING_MODULE } from "../../modules/shipment-tracking"
import type ShipmentTrackingModuleService from "../../modules/shipment-tracking/service"
import { isFinal } from "../../modules/shipment-tracking/states"
import { refreshShipmentWorkflow } from "./refresh-shipment"

// A notification makes a parcel be asked about at most this often
const THROTTLE_MS = 60 * 1000

export type NotificationOutcome = "refreshed" | "not_ours" | "recently_checked" | "failed"

/**
 * A Geliver notification about a shipment (adr/0031): unsigned, so only a
 * hint. A parcel we track and have not asked about in the last minute is
 * asked about again; its body is never written down. Anything else is
 * acknowledged and left.
 */
export async function handleGeliverNotification(
  container: MedusaContainer,
  shipmentId: string,
  now = new Date()
): Promise<NotificationOutcome> {
  const [tracked] = await container
    .resolve<ShipmentTrackingModuleService>(SHIPMENT_TRACKING_MODULE)
    .listTrackedShipments(
      { provider: "geliver", provider_shipment_id: shipmentId },
      { take: 1, select: ["id", "status", "checked_at"] }
    )
  if (!tracked || isFinal(tracked.status)) {
    return "not_ours"
  }
  if (tracked.checked_at && now.getTime() - new Date(tracked.checked_at).getTime() < THROTTLE_MS) {
    return "recently_checked"
  }
  try {
    await refreshShipmentWorkflow(container).run({ input: { tracked_shipment_id: tracked.id } })
    return "refreshed"
  } catch (error) {
    logger.warn({
      event: "shipping.notification_failed",
      trackedShipmentId: tracked.id,
      err: errorSummary(error),
    })
    return "failed"
  }
}
