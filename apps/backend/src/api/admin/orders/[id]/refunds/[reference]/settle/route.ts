import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../../../../../../lib/errors"
import { settleRefundByHandWorkflow } from "../../../../../../../workflows/orders/settle-refund-by-hand"
import { AUDIT_RESULT } from "../../../../../../http/audit/notes"
import { LEDGER_REFERENCE } from "../../validators"
import type { AdminPostOrderRefundSettleType } from "../../validators"

/**
 * A refund left open, checked by staff at the provider (review
 * 2026-11-17, O2): `made` closes it with its records, `not_made` fails it
 * and frees its lines, `made_in_part` closes an iyzico refund made in part
 * at its answered parts and frees the rest (D4-1); `lost_part` answers for
 * an iyzico part whose answer was lost, the ledger deciding the rest (M2).
 * Sends no refund; the audit log keeps who and when, the answer given, and
 * the amount before and after.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostOrderRefundSettleType>,
  res: MedusaResponse
): Promise<void> {
  const reference = req.params["reference"] ?? ""
  if (!LEDGER_REFERENCE.test(reference)) {
    throw new ValidationError("orders.refund_reference_invalid", { field: "reference" })
  }
  const { outcome, lost_part } = req.validatedBody
  const { result } = await settleRefundByHandWorkflow(req.scope).run({
    input: {
      order_id: req.params["id"] ?? "",
      reference,
      outcome,
      lost_part,
      actor_id: req.auth_context.actor_id,
    },
  })
  // What staff said, beside the before and after the audit snapshot keeps
  res.locals[AUDIT_RESULT] = {
    status: result.status,
    ...(outcome ? { outcome } : {}),
    ...(lost_part ? { lost_part } : {}),
  }
  res.json({ refund: result })
}
