import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../../../../lib/logging"
import { BOOKING_MODULE } from "../../../../../modules/booking"
import type BookingModuleService from "../../../../../modules/booking/service"
import { auditContext, auditService } from "../../../../http/audit/context"
import { rejectRequest } from "../../../../http/reject"

/**
 * POST /admin/booking-travelers/:id/reveal (adr/0076 §7): a booked
 * traveler's full ID or passport number, for the departure's list.
 * Owner and admin (the role table; operations and read-only refused),
 * proved again in the request (`requireReauth`), and recorded against the
 * traveler first: no record, no number (adr/0009, as the tax id's reveal).
 * Behind `catalog.booking`.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const travelerId = (req.params as Record<string, string | undefined>)["id"] ?? ""
  const service = req.scope.resolve<BookingModuleService>(BOOKING_MODULE)
  const [traveler] = await service.listBookingTravelers(
    { id: travelerId, booking_id: { $ne: null } },
    { take: 1, select: ["id", "booking_id", "slot_id"] }
  )
  if (!traveler) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "booking.traveler_unknown")
  }
  try {
    await auditService(req).record({
      kind: "sensitive_read",
      action: "POST /admin/booking-travelers/:id/reveal",
      resource_type: "booking_traveler",
      resource_id: traveler.id,
      changes: { field: "document_no", booking_id: traveler.booking_id, slot_id: traveler.slot_id },
      ...auditContext(req),
    })
  } catch (error) {
    logger.error({
      event: "audit.write_failed",
      action: "booking_traveler.reveal",
      err: errorSummary(error),
    })
    rejectRequest(
      req,
      res,
      503,
      { type: "temporarily_unavailable", message: "errors.temporarily_unavailable" },
      "audit_unavailable"
    )
    return
  }
  const documentNo = await service.revealTravelerDocument(traveler.id)
  // Not to be kept by a cache on the way
  res.setHeader("cache-control", "no-store")
  res.json({ id: traveler.id, document_no: documentNo })
}
