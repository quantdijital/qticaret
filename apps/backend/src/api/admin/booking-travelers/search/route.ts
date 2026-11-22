import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { errorSummary, logger } from "../../../../lib/logging"
import { findBookingTravelers } from "../../../../workflows/booking/traveler-requests"
import { auditContext, auditService } from "../../../http/audit/context"
import { AUDIT_RESULT } from "../../../http/audit/notes"
import { rejectRequest } from "../../../http/reject"
import type { AdminPostTravelerSearchType } from "../validators"

/**
 * POST /admin/booking-travelers/search (adr/0076 Ek D6b): a traveler's
 * own KVKK request, their rows found by what they gave (a POST, so the
 * name stays out of the URL and the logs). Owner and admin by the role
 * table; recorded first as a sensitive read (no record, no answer), the
 * entry holding only how many were found. The number shows masked.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostTravelerSearchType>,
  res: MedusaResponse
): Promise<void> {
  const found = await findBookingTravelers(req.scope, req.validatedBody)
  try {
    await auditService(req).record({
      kind: "sensitive_read",
      action: "POST /admin/booking-travelers/search",
      resource_type: "booking_traveler",
      resource_id: null,
      changes: {
        found: found.length,
        by_birth_date: Boolean(req.validatedBody.birth_date?.trim()),
        by_document: Boolean(req.validatedBody.document_no?.trim()),
      },
      ...auditContext(req),
    })
  } catch (error) {
    logger.error({
      event: "audit.write_failed",
      action: "booking_traveler.search",
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
  res.locals[AUDIT_RESULT] = { found: found.length }
  res.setHeader("cache-control", "no-store")
  res.json({ travelers: found })
}
