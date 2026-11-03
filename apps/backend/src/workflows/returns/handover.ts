import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../../lib/logging"
import { RETURN_REQUESTS_MODULE } from "../../modules/return-requests"
import type ReturnRequestsModuleService from "../../modules/return-requests/service"
import { withCarrier } from "../../modules/shipment-tracking/states"
import type { ShipmentStatus } from "../../modules/shipment-tracking/states"
import { carrierReader } from "../shipping/carrier-status"

// A run asks about this many return parcels at most, those approved first
const BATCH = 50

/**
 * The carrier has the return parcel: on its way, at the shop, or sent
 * back to the shopper (it had it then too). From here the law's 14 days to
 * refund run (MSY md. 12/1).
 */
export const handedOver = (status: ShipmentStatus): boolean =>
  withCarrier(status) || status === "returned"

/**
 * Return parcels the shopper may have handed over (adr/0032 Ek
 * 2026-11-03): each approved request with a carrier return not yet seen
 * with the carrier is asked about at its carrier, as the outbound parcels
 * are (`pollShipments`), and its handover recorded once, at the time it
 * is first seen. Only Geliver opens carrier returns today (adr/0032 §4).
 * A parcel that cannot be read is logged and asked again a run later.
 * Returns how many were recorded.
 */
export async function pollReturnHandovers(
  container: MedusaContainer,
  now = new Date()
): Promise<number> {
  const service = container.resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
  const waiting = await service.listReturnRequests(
    { status: "approved", return_shipment_id: { $ne: null }, handed_over_at: null },
    { take: BATCH, order: { decided_at: "ASC" }, select: ["id", "return_shipment_id"] }
  )
  let recorded = 0
  for (const request of waiting) {
    try {
      const reading = await carrierReader("geliver")(container, request.return_shipment_id ?? "")
      if (handedOver(reading.status)) {
        await service.updateReturnRequests({ id: request.id, handed_over_at: now })
        recorded += 1
      }
    } catch (error) {
      logger.warn({
        event: "returns.handover_poll_failed",
        returnRequestId: request.id,
        err: errorSummary(error),
      })
    }
  }
  return recorded
}
