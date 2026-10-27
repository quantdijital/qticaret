import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { moveChargebackWorkflow } from "../../../../workflows/chargebacks/move-chargeback"
import type { AdminPostChargebackMoveType } from "../validators"
import { chargebackView } from "../view"

/** POST /admin/chargebacks/:id: evidence sent, won or lost (adr/0030). */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostChargebackMoveType>,
  res: MedusaResponse
): Promise<void> {
  const { status, note } = req.validatedBody
  const { result } = await moveChargebackWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "", status, ...(note === undefined ? {} : { note }) },
  })
  res.json({ chargeback: chargebackView(result) })
}
