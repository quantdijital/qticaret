import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { STAFF_ROLES } from "../lib/staff"
import type { StaffRole } from "../lib/staff"
import { logger } from "../lib/logging"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { STAFF_ROLES_MODULE } from "../modules/staff-roles"
import type StaffRolesModuleService from "../modules/staff-roles/service"

const isRole = (value: string): value is StaffRole =>
  (STAFF_ROLES as readonly string[]).includes(value)

/**
 * Gives a staff member a role from the server's shell (`medusa exec
 * ./src/scripts/set-staff-role.ts <email> <role>`): the e2e run's own
 * admin, or a shop whose owner lost access. Recorded as the system's.
 */
export default async function setStaffRole({ container, args }: ExecArgs) {
  const [email = "", role = ""] = args
  if (!isRole(role)) {
    throw new Error(`set-staff-role: the role is one of ${STAFF_ROLES.join(", ")}`)
  }
  const [user] = await container.resolve(Modules.USER).listUsers({ email }, { select: ["id"] })
  if (!user) {
    throw new Error("set-staff-role: no such user")
  }
  await container.resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE).setRole(user.id, role, null)
  await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
    kind: "system",
    action: "staff.role_set",
    actor_type: "system",
    resource_type: "user",
    resource_id: user.id,
    changes: { role },
  })
  logger.info({ event: "staff.role_set", role })
}
