import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { parseEnv } from "../../lib/env"
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
 * asked about again; its body is never written down. The minute is
 * claimed under a lock, so notifications at once ask once.
 * A test parcel moves on with every read at Geliver: on a deployed shop
 * only the job reads it, so no stranger's notification pushes it along.
 * Anything else is acknowledged and left.
 */
export async function handleGeliverNotification(
  container: MedusaContainer,
  shipmentId: string,
  now = new Date()
): Promise<NotificationOutcome> {
  const service = container.resolve<ShipmentTrackingModuleService>(SHIPMENT_TRACKING_MODULE)
  const [tracked] = await service.listTrackedShipments(
    { provider: "geliver", provider_shipment_id: shipmentId },
    { take: 1, select: ["id", "status", "test"] }
  )
  const env = parseEnv().NODE_ENV
  const deployed = env !== "development" && env !== "test"
  if (!tracked || isFinal(tracked.status) || (tracked.test && deployed)) {
    return "not_ours"
  }
  // Read and claimed under a lock: Medusa's update reads before it writes, so it alone is not enough
  const claimed = await container.resolve(Modules.LOCKING).execute(
    `shipping:notify:${tracked.id}`,
    async () => {
      const [current] = await service.listTrackedShipments(
        { id: tracked.id },
        { take: 1, select: ["checked_at"] }
      )
      const last = current?.checked_at ? new Date(current.checked_at).getTime() : null
      if (last !== null && now.getTime() - last < THROTTLE_MS) {
        return false
      }
      await service.updateTrackedShipments({ id: tracked.id, checked_at: now })
      return true
    },
    { timeout: 5 }
  )
  if (!claimed) {
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
