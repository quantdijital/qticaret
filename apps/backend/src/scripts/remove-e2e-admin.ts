import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { logger } from "../lib/logging"
import { STAFF_ROLES_MODULE } from "../modules/staff-roles"
import type StaffRolesModuleService from "../modules/staff-roles/service"
import { removeStaffMemberWorkflow } from "../workflows/staff/remove-member"
import { E2E_STAFF_EMAIL } from "./demo-removal/select"

interface StaffRow {
  id: string
  user_id: string
  role: string
}

/**
 * How the e2e admin leaves. On a shop with staff of its own the admin is
 * one more owner and leaves as any member does (`member`). On a shop
 * made for the run (CI: a fresh database) it is the only staff member and
 * so the last owner, which the member removal refuses (`staff.last_owner`):
 * its role goes first and the shop is back to having no staff, as before
 * the run, when its first user becomes owner (`sole`). Never leaves other
 * staff without an owner (`refuse`).
 */
export function e2eAdminExit(
  staff: readonly StaffRow[],
  userId: string
): "member" | "sole" | "refuse" {
  const own = staff.find((row) => row.user_id === userId)
  const otherOwners = staff.filter((row) => row.role === "owner" && row.user_id !== userId)
  if (own?.role !== "owner" || otherOwners.length > 0) {
    return "member"
  }
  return staff.length === 1 ? "sole" : "refuse"
}

/**
 * Removes the admin an e2e run made, with its role and login (`NODE_ENV=development
 * medusa exec ./src/scripts/remove-e2e-admin.ts <email>`). A user cannot delete
 * itself through the API; anything but an address the panel's e2e setup
 * makes (apps/panel/e2e/support/admin.ts) is refused.
 */
export default async function removeE2eAdmin({ container, args }: ExecArgs) {
  const email = args[0] ?? ""
  if (!E2E_STAFF_EMAIL.test(email)) {
    throw new Error("remove-e2e-admin: not an e2e admin address")
  }
  const [user] = await container.resolve(Modules.USER).listUsers({ email }, { select: ["id"] })
  if (!user) {
    return
  }
  const roles = container.resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
  const staff = await roles.listStaffRoles({}, { select: ["id", "user_id", "role"], take: null })
  const exit = e2eAdminExit(staff, user.id)
  if (exit === "refuse") {
    throw new Error("remove-e2e-admin: the e2e admin is the last owner of a shop with other staff")
  }
  const own = staff.find((row) => row.user_id === user.id)
  if (exit === "sole" && own) {
    await roles.deleteStaffRoles(own.id)
  }
  try {
    await removeStaffMemberWorkflow(container).run({ input: { user_id: user.id } })
  } catch (error) {
    // Its login is still there: so is its role, and the shop's owner
    if (exit === "sole") {
      await roles.setRole(user.id, "owner", null)
    }
    throw error
  }
  logger.info({ event: "e2e.admin_removed", exit })
}
