import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deactivateAccountWorkflow } from "../../../../../../workflows/wholesale/accounts/status"
import { accountIdOf, accountViewOf } from "../../../account-view"

/**
 * `POST /admin/wholesale/accounts/:id/deactivate` (ADR-0068 §3): the
 * wholesaler pays retail from the next request; open carts priced again.
 * Open in a restricted or suspended shop (adr/0061 §5.5).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = await accountIdOf(req)
  await deactivateAccountWorkflow(req.scope).run({
    input: { id, updated_by: req.auth_context.actor_id || null },
  })
  res.json({ account: await accountViewOf(req, id) })
}
