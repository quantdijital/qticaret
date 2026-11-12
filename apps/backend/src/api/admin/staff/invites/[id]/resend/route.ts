import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { refreshInviteTokensWorkflow } from "@medusajs/medusa/core-flows"
import {
  assertStaffSeat,
  assertStaffWithinLimit,
  forgetUsage,
} from "../../../../../../lib/plan-limits"
import { INVITABLE_ROLES } from "../../../../../../lib/staff"
import type { InvitableRole } from "../../../../../../lib/staff"
import { inviteView, sendInvite } from "../../../view"
import type { InviteRow } from "../../../view"

async function recountOrExpire(
  req: AuthenticatedMedusaRequest,
  id: string,
  expiredAt: Date | string
): Promise<void> {
  try {
    await assertStaffWithinLimit(req.scope)
  } catch (error) {
    // `expires_at` is a column of Medusa's invite; its update takes it as any field
    await req.scope
      .resolve(Modules.USER)
      .updateInvites({ id, expires_at: new Date(expiredAt) } as never)
    forgetUsage("staff")
    throw error
  }
}

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
  const expired = new Date(current.expires_at).getTime() <= Date.now()
  if (expired) {
    await assertStaffSeat(req.scope)
  }
  const { result } = await refreshInviteTokensWorkflow(req.scope).run({
    input: { invite_ids: [id] },
  })
  const invite = result[0] as (InviteRow & { token: string }) | undefined
  if (!invite) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "staff.invite_unknown")
  }
  // Ek C19 L3: counted again once it holds a seat, as a new invitation is
  // (review M2): two sent together cannot both take the last seat. Past
  // the limit it is expired again (its new link dead, nothing sent)
  if (expired) {
    await recountOrExpire(req, id, current.expires_at)
  }
  forgetUsage("staff")
  const link = await sendInvite(req.scope, invite, role as InvitableRole)
  res.json({ invite: inviteView(invite), link })
}
