import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { closePrivacyRequestWorkflow } from "../../../../../workflows/legal/privacy-requests"
import type { AdminPostPrivacyRequestCloseType } from "../../validators"

/**
 * POST /admin/privacy-requests/:id/close (F13.5): the request answered
 * (`completed`: the copy sent) or refused (`rejected`: the asker not shown
 * to be the customer). An erasure is completed by its own route.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostPrivacyRequestCloseType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await closePrivacyRequestWorkflow(req.scope).run({
    input: {
      request_id: req.params["id"] ?? "",
      status: req.validatedBody.status,
      by: req.auth_context.actor_id,
    },
  })
  res.json({ privacy_request: { id: result.id, status: result.status } })
}
