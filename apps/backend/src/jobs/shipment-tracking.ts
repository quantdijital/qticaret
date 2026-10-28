import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { SHIPMENT_TRACKING_MODULE } from "../modules/shipment-tracking"
import type ShipmentTrackingModuleService from "../modules/shipment-tracking/service"
import { refreshShipmentWorkflow } from "../workflows/shipping/refresh-shipment"

// Asked again at most this often by the job; a notification can ask sooner
const RECHECK_MS = 25 * 60 * 1000
// A run asks about this many parcels at most, the least recently checked first
const BATCH = 50
const OPEN = ["created", "picked_up", "in_transit", "out_for_delivery"] as const

/**
 * Parcels whose carrier sent no notification (F7.6, adr/0031): each open
 * parcel not asked about lately is asked again, through the same workflow
 * as a notification. A parcel that fails is logged and tried next run.
 */
export async function pollShipments(container: MedusaContainer, now = new Date()): Promise<number> {
  const service = container.resolve<ShipmentTrackingModuleService>(SHIPMENT_TRACKING_MODULE)
  const due = await service.listTrackedShipments(
    {
      status: [...OPEN],
      $or: [{ checked_at: null }, { checked_at: { $lte: new Date(now.getTime() - RECHECK_MS) } }],
    },
    { take: BATCH, order: { checked_at: "ASC" }, select: ["id"] }
  )
  let moved = 0
  for (const { id } of due) {
    try {
      const { result } = await refreshShipmentWorkflow(container).run({
        input: { tracked_shipment_id: id },
      })
      moved += result.moved ? 1 : 0
    } catch (error) {
      logger.warn({
        event: "shipping.poll_failed",
        trackedShipmentId: id,
        err: errorSummary(error),
      })
    }
  }
  return moved
}

export default async function shipmentTracking(container: MedusaContainer) {
  await pollShipments(container)
}

export const config = {
  name: "shipment-tracking",
  schedule: "*/30 * * * *",
}
