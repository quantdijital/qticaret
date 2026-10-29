import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { refreshInviteTokensWorkflow } from "@medusajs/medusa/core-flows"
import { INVITABLE_ROLES } from "../../../../../../lib/staff"
import type { InvitableRole } from "../../../../../../lib/staff"
import { inviteView, sendInvite } from "../../../view"
import type { InviteRow } from "../../../view"

/**
 * POST /admin/staff/invites/:id/resend (owner): a fresh link for another
 * day, sent again; the old link stops working.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = (req.params as Record<string, string | undefined>)["id"] ?? ""
  const [current] = (await req.scope
    .resolve(Modules.USER)
    .listInvites({ id }, { select: ["id", "metadata"], take: 1 })) as InviteRow[]
  const role = current?.metadata?.["role"]
  if (!current || !(INVITABLE_ROLES as readonly unknown[]).includes(role)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "staff.invite_unknown")
  }
  const { result } = await refreshInviteTokensWorkflow(req.scope).run({
    input: { invite_ids: [id] },
  })
  const invite = result[0] as (InviteRow & { token: string }) | undefined
  if (!invite) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "staff.invite_unknown")
  }
  const link = await sendInvite(req.scope, invite, role as InvitableRole)
  res.json({ invite: inviteView(invite), link })
}
