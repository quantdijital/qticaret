import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../../../lib/errors"
import { inviteStaffWorkflow } from "../../../../workflows/staff/invites"
import type { AdminPostStaffInviteType } from "../validators"
import { addressTaken, inviteView, sendInvite } from "../view"
import type { InviteRow } from "../view"

/**
 * POST /admin/staff/invites (owner): an invitation with its role, sent by
 * e-mail; its link in this answer only, for the owner to pass on by hand.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStaffInviteType>,
  res: MedusaResponse
): Promise<void> {
  const { email, role } = req.validatedBody
  const taken = await addressTaken(req.scope, email)
  if (taken) {
    throw new ValidationError(taken === "member" ? "staff.invite_member" : "staff.invite_pending", {
      field: "email",
    })
  }
  const { result } = await inviteStaffWorkflow(req.scope).run({
    input: { email, role, invited_by: req.auth_context.actor_id },
  })
  const invite = result[0] as (InviteRow & { token: string }) | undefined
  if (!invite) {
    throw new ValidationError("staff.invite_failed")
  }
  const link = await sendInvite(req.scope, invite, role)
  res.status(201).json({ invite: inviteView(invite), link })
}
