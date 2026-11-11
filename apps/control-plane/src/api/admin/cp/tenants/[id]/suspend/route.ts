import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { moveFromRequest } from "../../status-move"
import type { PostStatusMoveType } from "../../validators"

/**
 * POST /admin/cp/tenants/:id/suspend (owner, operator, step-up; Ek C15):
 * an active or restricted shop suspended, with the reason. Its storefront
 * answers 503 and its panel reads only, once its plan document arrives.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostStatusMoveType>,
  res: MedusaResponse
): Promise<void> {
  await moveFromRequest(req, res, "suspend")
}
