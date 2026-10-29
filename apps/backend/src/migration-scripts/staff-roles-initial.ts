import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { StaffRole } from "../lib/staff"
import { logger } from "../lib/logging"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { STAFF_ROLES_MODULE } from "../modules/staff-roles"
import type StaffRolesModuleService from "../modules/staff-roles/service"

interface User {
  id: string
  created_at: Date | string
}

/** The roles a shop's staff get when roles arrive: its first user owns it, the others admin it. */
export function initialRoles(users: readonly User[]): { user_id: string; role: StaffRole }[] {
  const ordered = [...users].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  return ordered.map((user, index) => ({ user_id: user.id, role: index === 0 ? "owner" : "admin" }))
}

/**
 * Runs once per shop, on the `db:migrate` that brings roles (F12.6,
 * adr/0040): until now every signed-in user could do everything, so none
 * loses a right it used; the owner's alone are the first user's. A shop
 * that already has roles is left as it is.
 */
export default async function staffRolesInitial({ container }: ExecArgs) {
  const roles = container.resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
  if ((await roles.listStaffRoles({}, { select: ["id"], take: 1 })).length > 0) {
    return
  }
  const users = (await container
    .resolve(Modules.USER)
    .listUsers({}, { select: ["id", "created_at"], take: 10_000 })) as User[]
  const given = initialRoles(users)
  for (const { user_id, role } of given) {
    await roles.setRole(user_id, role, null)
  }
  if (given.length > 0) {
    await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
      kind: "system",
      action: "staff.roles_initialized",
      actor_type: "system",
      resource_type: "staff_role",
      resource_id: null,
      changes: { roles: given },
    })
  }
  logger.info({ event: "staff.roles_initialized", users: given.length })
}
