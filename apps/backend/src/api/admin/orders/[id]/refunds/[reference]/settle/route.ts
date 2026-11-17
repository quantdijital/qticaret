import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../../../../../../lib/errors"
import { settleRefundByHandWorkflow } from "../../../../../../../workflows/orders/settle-refund-by-hand"
import { LEDGER_REFERENCE } from "../../validators"
import type { AdminPostOrderRefundSettleType } from "../../validators"

/**
 * A refund left open, checked by staff at the provider (review
 * 2026-11-17, O2): `made` closes it with its records, `not_made` fails it
 * and frees its lines, `made_in_part` closes an iyzico refund made in part
 * at its answered parts and frees the rest (D4-1). Sends no refund; the
 * audit log keeps who and when, and the amount before and after.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostOrderRefundSettleType>,
  res: MedusaResponse
): Promise<void> {
  const reference = req.params["reference"] ?? ""
  if (!LEDGER_REFERENCE.test(reference)) {
    throw new ValidationError("orders.refund_reference_invalid", { field: "reference" })
  }
  const { result } = await settleRefundByHandWorkflow(req.scope).run({
    input: {
      order_id: req.params["id"] ?? "",
      reference,
      outcome: req.validatedBody.outcome,
      actor_id: req.auth_context.actor_id,
    },
  })
  res.json({ refund: result })
}
