import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cancelReturnRequestWorkflow } from "../../../../../workflows/returns/cancel-return"
import type { AdminPostReturnCancelType } from "../../validators"
import { returnRequestDetail } from "../../view"

/**
 * POST /admin/return-requests/:id/cancel: an approval taken back while
 * nothing has come back (`cancelReturnRequestWorkflow`): the carrier's
 * return withdrawn, Medusa's return or exchange cancelled, the lines
 * open to be asked again; the reason stays with the team.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostReturnCancelType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await cancelReturnRequestWorkflow(req.scope).run({
    input: {
      id: req.params["id"] ?? "",
      staff_id: req.auth_context.actor_id,
      reason: req.validatedBody.reason,
    },
  })
  res.json({ return_request: await returnRequestDetail(req.scope, result) })
}
