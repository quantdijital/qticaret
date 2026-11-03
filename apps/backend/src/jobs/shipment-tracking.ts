import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { SHIPMENT_TRACKING_MODULE } from "../modules/shipment-tracking"
import type ShipmentTrackingModuleService from "../modules/shipment-tracking/service"
import { pollReturnHandovers } from "../workflows/returns/handover"
import { refreshShipmentWorkflow } from "../workflows/shipping/refresh-shipment"

// Asked again at most this often by the job; a notification can ask sooner
const RECHECK_MS = 25 * 60 * 1000
// A run asks about this many parcels at most, the least recently checked first
const BATCH = 50
const OPEN = ["created", "picked_up", "in_transit", "out_for_delivery"] as const

/**
 * Parcels whose carrier sent no notification (F7.6, adr/0031): each open
 * parcel not asked about lately is asked again, through the same workflow
 * as a notification, those never asked first. A parcel that fails is
 * logged, marked asked, and tried again a run later.
 */
export async function pollShipments(container: MedusaContainer, now = new Date()): Promise<number> {
  const service = container.resolve<ShipmentTrackingModuleService>(SHIPMENT_TRACKING_MODULE)
  // Never asked first (the database sorts nulls last), then the least recently asked
  const fresh = await service.listTrackedShipments(
    { status: [...OPEN], checked_at: null },
    { take: BATCH, order: { created_at: "ASC" }, select: ["id"] }
  )
  const stale =
    fresh.length < BATCH
      ? await service.listTrackedShipments(
          { status: [...OPEN], checked_at: { $lte: new Date(now.getTime() - RECHECK_MS) } },
          { take: BATCH - fresh.length, order: { checked_at: "ASC" }, select: ["id"] }
        )
      : []
  const due = [...fresh, ...stale]
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
      // Asked, if in vain: tried again a run later, not ahead of every other parcel
      await service.updateTrackedShipments({ id, checked_at: now }).catch((update: unknown) => {
        logger.warn({
          event: "shipping.poll_mark_failed",
          trackedShipmentId: id,
          err: errorSummary(update),
        })
      })
    }
  }
  return moved
}

export default async function shipmentTracking(container: MedusaContainer) {
  await pollShipments(container)
  // Return parcels too: their handover starts the law's 14 days to refund (adr/0032 Ek 2026-11-03)
  await pollReturnHandovers(container)
}

export const config = {
  name: "shipment-tracking",
  schedule: "*/30 * * * *",
}
