import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { approveReturnWorkflow } from "../../../../../workflows/returns/approve-return"
import type { AdminPostReturnApproveType } from "../../validators"

/** POST /admin/return-requests/:id/approve: Medusa's return and the carrier's return code (adr/0032). */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostReturnApproveType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await approveReturnWorkflow(req.scope).run({
    input: {
      id: req.params["id"] ?? "",
      staff_id: req.auth_context.actor_id,
      note: req.validatedBody.note ?? null,
    },
  })
  res.json({ return_request: result })
}
