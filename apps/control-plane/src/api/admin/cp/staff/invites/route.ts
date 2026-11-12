import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { inviteCpStaffWorkflow } from "../../../../../workflows/cp-staff/invites"
import type { PostCpInviteType } from "../../validators"
import { addressTaken, inviteView, sendInvite } from "../../../../../lib/staff/invites"
import type { InviteRow } from "../../../../../lib/staff/invites"

/**
 * POST /admin/cp/staff/invites (owner, step-up; adr/0061 §3.5): an
 * invitation with its role (any, an owner's too: accepted only while the
 * inviting owner still is one), sent by e-mail; its link in this answer
 * only, for the owner to pass on by hand when no e-mail goes out
 * (`mailed: false`). Never stored by us.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostCpInviteType>,
  res: MedusaResponse
): Promise<void> {
  const { email, role } = req.validatedBody
  const taken = await addressTaken(req.scope, email)
  if (taken) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      taken === "member" ? "cp.invite_member" : "cp.invite_pending"
    )
  }
  const { result } = await inviteCpStaffWorkflow(req.scope).run({
    input: { email, role, invited_by: req.auth_context.actor_id },
  })
  const invite = result[0] as (InviteRow & { token: string }) | undefined
  if (!invite) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "cp.invite_failed")
  }
  const sent = await sendInvite(req.scope, invite, role)
  res.setHeader("Cache-Control", "no-store")
  res.status(201).json({ invite: inviteView(invite), ...sent })
}
