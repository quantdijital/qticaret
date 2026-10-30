import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { STAFF_ROLES_MODULE } from "../../../modules/staff-roles"
import type StaffRolesModuleService from "../../../modules/staff-roles/service"
import { mfaOnFor } from "../../../workflows/staff/mfa"
import { staffRoleOf } from "../../http/staff-guard"
import { inviteView } from "./view"
import type { InviteRow } from "./view"

// A shop's staff and its open invitations fit one page
const LIMIT = 500

/**
 * GET /admin/staff (F12.6, adr/0040): the shop's people with their roles
 * and whether their 2FA is on;
 * the owner also sees the open invitations. Who may read it is the role
 * table's (owner, admin).
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
  const roles = await req.scope
    .resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
    .rolesOf(members.map((member) => member.id))
  const mfaOn = await mfaOnFor(
    req.scope,
    members.map((member) => member.email.toLowerCase())
  )
  const invites =
    (await staffRoleOf(req)) === "owner"
      ? (
          (await users.listInvites(
            {},
            {
              select: ["id", "email", "metadata", "expires_at", "created_at"],
              order: { created_at: "DESC" },
              take: LIMIT,
            }
          )) as InviteRow[]
        ).map(inviteView)
      : null
  res.json({
    staff: members.map((member) => ({
      id: member.id,
      email: member.email,
      first_name: member.first_name,
      last_name: member.last_name,
      created_at: member.created_at,
      role: roles.get(member.id) ?? null,
      mfa: mfaOn.has(member.email.toLowerCase()),
      you: member.id === req.auth_context.actor_id,
    })),
    invites,
  })
}
