import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { z } from "@medusajs/framework/zod"
import { errorSummary, logger } from "../../../../lib/logging"
import { checkVoucher } from "../../../../workflows/booking/voucher"
import { auditContext, auditService } from "../../../http/audit/context"
import type { AdminPostVoucherCheck } from "../../../http/booking-voucher-routes"

/**
 * POST /admin/booking-vouchers/check (adr/0076 Ek D7b): a voucher's code
 * typed at a departure → whether its booking stands (`valid`), was
 * cancelled, or there is no such code (`unknown`, nothing more said).
 * Every role that reads orders; each check is recorded with its result
 * and the booking, never the code. Within the check's own budget.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<z.infer<typeof AdminPostVoucherCheck>>,
  res: MedusaResponse
): Promise<void> {
  const result = await checkVoucher(req.scope, req.validatedBody.code)
  try {
    await auditService(req).record({
      kind: "sensitive_read",
      action: "POST /admin/booking-vouchers/check",
      resource_type: "booking",
      resource_id: result.status === "unknown" ? null : result.booking_id,
      changes: { result: result.status },
      ...auditContext(req),
    })
  } catch (error) {
    // The check reads no personal data: the answer stands, the gap is logged
    logger.error({
      event: "audit.write_failed",
      action: "booking_voucher.check",
      err: errorSummary(error),
    })
  }
  res.setHeader("Cache-Control", "no-store")
  res.json(result)
}
