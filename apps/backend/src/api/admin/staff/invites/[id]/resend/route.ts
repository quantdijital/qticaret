import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { refreshInviteTokensWorkflow } from "@medusajs/medusa/core-flows"
import { assertStaffSeat, forgetUsage } from "../../../../../../lib/plan-limits"
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
    .listInvites({ id }, { select: ["id", "metadata", "expires_at"], take: 1 })) as (InviteRow & {
    expires_at: Date | string
  })[]
  const role = current?.metadata?.["role"]
  if (!current || !(INVITABLE_ROLES as readonly unknown[]).includes(role)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "staff.invite_unknown")
  }
  // adr/0061 Ek C14 review M1: a fresh token renews `expires_at` (Medusa's
  // `refreshInviteTokens`), so an expired invitation sent again takes a seat
  // again: within the package's team limit only. A live one holds its seat already
  if (new Date(current.expires_at).getTime() <= Date.now()) {
    await assertStaffSeat(req.scope)
  }
  const { result } = await refreshInviteTokensWorkflow(req.scope).run({
    input: { invite_ids: [id] },
  })
  const invite = result[0] as (InviteRow & { token: string }) | undefined
  if (!invite) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "staff.invite_unknown")
  }
  forgetUsage("staff")
  const link = await sendInvite(req.scope, invite, role as InvitableRole)
  res.json({ invite: inviteView(invite), link })
}
