import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { confirmBankTransferWorkflow } from "../../../../../../workflows/payments/confirm-bank-transfer"

/**
 * POST /admin/orders/:id/bank-transfer/confirm (F6 W2, adr/0029): the
 * shop saw the transfer in its bank. The order's payment is captured; one
 * already paid is only reported.
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { result } = await confirmBankTransferWorkflow(req.scope).run({
    input: { order_id: req.params["id"] ?? "", confirmed_by: req.auth_context.actor_id },
  })
  res.json({ bank_transfer: result })
}
