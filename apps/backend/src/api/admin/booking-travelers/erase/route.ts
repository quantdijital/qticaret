import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { eraseBookingTravelers } from "../../../../workflows/booking/traveler-requests"
import { AUDIT_RESULT } from "../../../http/audit/notes"
import type { AdminPostTravelerEraseType } from "../validators"

/**
 * POST /admin/booking-travelers/erase (adr/0076 Ek D6b): the rows a
 * traveler's own KVKK request found, deleted for good, booked or not.
 * Owner and admin by the role table, proved again (`requireReauth`);
 * recorded as a mutation with how many went and the ids of their bookings
 * and departures (never who). The order keeps its lines and amounts.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostTravelerEraseType>,
  res: MedusaResponse
): Promise<void> {
  const { deleted, booking_ids, slot_ids } = await eraseBookingTravelers(
    req.scope,
    req.validatedBody.ids
  )
  // The entry tells which bookings and departures lost a traveler, never who they were
  res.locals[AUDIT_RESULT] = { deleted, booking_ids, slot_ids }
  res.json({ deleted })
}
