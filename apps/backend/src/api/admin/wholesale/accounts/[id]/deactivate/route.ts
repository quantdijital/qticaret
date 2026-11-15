import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deactivateAccountWorkflow } from "../../../../../../workflows/wholesale/accounts/status"
import { AUDIT_RESULT } from "../../../../../http/audit/notes"
import { accountIdOf, accountViewOf } from "../../../account-view"

/**
 * `POST /admin/wholesale/accounts/:id/deactivate` (ADR-0068 §3): the
 * wholesaler pays retail from the next request; every open cart is priced
 * again, `carts` saying how many and how many could not be (also in the
 * audit entry). Open in a restricted or suspended shop (adr/0061 §5.5).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = await accountIdOf(req)
  const { result } = await deactivateAccountWorkflow(req.scope).run({
    input: { id, updated_by: req.auth_context.actor_id || null },
  })
  res.locals[AUDIT_RESULT] = { carts: result.carts }
  res.json({ account: await accountViewOf(req, id), carts: result.carts })
}
