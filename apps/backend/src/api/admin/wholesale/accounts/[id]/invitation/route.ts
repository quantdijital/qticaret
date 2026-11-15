import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resendInvitationWorkflow } from "../../../../../../workflows/wholesale/accounts/status"
import { accountIdOf, accountViewOf } from "../../../account-view"

/**
 * `POST /admin/wholesale/accounts/:id/invitation` (ADR-0068 §3): a pending
 * wholesaler's invitation sent again, its 90 days from now. Counted per
 * staff member: each one mails an address in the shop's name.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = await accountIdOf(req)
  const { result } = await resendInvitationWorkflow(req.scope).run({
    input: { id, updated_by: req.auth_context.actor_id || null },
  })
  res.json({ account: await accountViewOf(req, id), message: result.message })
}
