import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reactivateAccountWorkflow } from "../../../../../../workflows/wholesale/accounts/status"
import { accountIdOf, accountViewOf } from "../../../account-view"

/** `POST /admin/wholesale/accounts/:id/reactivate`: a closed wholesaler at wholesale again. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = await accountIdOf(req)
  await reactivateAccountWorkflow(req.scope).run({
    input: { id, updated_by: req.auth_context.actor_id || null },
  })
  res.json({ account: await accountViewOf(req, id) })
}
