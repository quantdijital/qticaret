import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reactivateAccountWorkflow } from "../../../../../../workflows/wholesale/accounts/status"
import { AUDIT_RESULT } from "../../../../../http/audit/notes"
import { accountIdOf, accountViewOf } from "../../../account-view"

/** `POST /admin/wholesale/accounts/:id/reactivate`: a closed wholesaler at wholesale again. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = await accountIdOf(req)
  const { result } = await reactivateAccountWorkflow(req.scope).run({
    input: { id, updated_by: req.auth_context.actor_id || null },
  })
  res.locals[AUDIT_RESULT] = { carts: result.carts }
  res.json({ account: await accountViewOf(req, id), carts: result.carts })
}
