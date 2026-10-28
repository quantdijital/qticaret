import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rejectReturn } from "../../../../../workflows/returns/receive-return"
import type { AdminPostReturnRejectType } from "../../validators"
import { returnRequestView } from "../../view"

/** POST /admin/return-requests/:id/reject: turned down, with a note for the shopper. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostReturnRejectType>,
  res: MedusaResponse
): Promise<void> {
  const rejected = await rejectReturn(req.scope, {
    id: req.params["id"] ?? "",
    staff_id: req.auth_context.actor_id,
    note: req.validatedBody.note,
  })
  res.json({ return_request: returnRequestView(rejected) })
}
