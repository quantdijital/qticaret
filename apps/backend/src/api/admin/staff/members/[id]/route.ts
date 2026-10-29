import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { ValidationError } from "../../../../../lib/errors"
import { STAFF_ROLES_MODULE } from "../../../../../modules/staff-roles"
import type StaffRolesModuleService from "../../../../../modules/staff-roles/service"
import { removeStaffMemberWorkflow } from "../../../../../workflows/staff/remove-member"
import type { AdminPostStaffRoleType } from "../../validators"

async function memberOf(req: AuthenticatedMedusaRequest): Promise<string> {
  const id = (req.params as Record<string, string | undefined>)["id"] ?? ""
  const [user] = await req.scope
    .resolve(Modules.USER)
    .listUsers({ id }, { select: ["id"], take: 1 })
  if (!user) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "staff.unknown")
  }
  return user.id
}

/** POST /admin/staff/members/:id (owner): a new role; the shop's last owner keeps theirs. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostStaffRoleType>,
  res: MedusaResponse
): Promise<void> {
  const id = await memberOf(req)
  await req.scope
    .resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
    .setRole(id, req.validatedBody.role, req.auth_context.actor_id)
  res.json({ member: { id, role: req.validatedBody.role } })
}

/** DELETE /admin/staff/members/:id (owner): the member leaves, with their login; not oneself. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = await memberOf(req)
  if (id === req.auth_context.actor_id) {
    throw new ValidationError("staff.remove_self")
  }
  await removeStaffMemberWorkflow(req.scope).run({ input: { user_id: id } })
  res.json({ id, deleted: true })
}
