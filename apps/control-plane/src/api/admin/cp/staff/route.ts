import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { mfaOnFor } from "../../../../lib/staff/mfa"
import { cpStaff } from "../../../http/caller"
import { inviteView } from "../../../../lib/staff/invites"
import type { InviteRow } from "../../../../lib/staff/invites"

// The platform's staff and their open invitations fit one page
const LIMIT = 200

/**
 * GET /admin/cp/staff (owner, adr/0061 §3.5): the platform's staff with
 * their roles, whether they are active and have 2FA on, and the open
 * invitations. Recorded as a sensitive read.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const users = req.scope.resolve(Modules.USER)
  const members = await users.listUsers(
    {},
    {
      select: ["id", "email", "first_name", "last_name", "created_at"],
      order: { created_at: "ASC" },
      take: LIMIT,
    }
  )
  const states = await cpStaff(req).membersOf(members.map((member) => member.id))
  const withMfa = await mfaOnFor(
    req.scope,
    members.map((member) => member.email)
  )
  const invites = (await users.listInvites(
    {},
    {
      select: ["id", "email", "metadata", "expires_at", "created_at"],
      order: { created_at: "DESC" },
      take: LIMIT,
    }
  )) as InviteRow[]
  res.json({
    staff: members.map((member) => {
      const state = states.get(member.id)
      return {
        id: member.id,
        email: member.email,
        first_name: member.first_name,
        last_name: member.last_name,
        created_at: member.created_at,
        role: state?.role ?? null,
        active: state?.active ?? false,
        mfa: withMfa.has(member.email.toLowerCase()),
        you: member.id === req.auth_context.actor_id,
      }
    }),
    invites: invites.map(inviteView),
  })
}
