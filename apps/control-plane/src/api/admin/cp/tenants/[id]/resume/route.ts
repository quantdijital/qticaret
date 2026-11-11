import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { moveFromRequest } from "../../status-move"
import type { PostStatusMoveType } from "../../validators"

/**
 * POST /admin/cp/tenants/:id/resume (owner, operator, step-up; Ek C15): a
 * suspended shop opened again, with the reason: `restricted` if it was
 * restricted when suspended, `active` otherwise (lib/tenants/status-moves.ts).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostStatusMoveType>,
  res: MedusaResponse
): Promise<void> {
  await moveFromRequest(req, res, "resume")
}
