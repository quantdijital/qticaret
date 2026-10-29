import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import { removeUserAccountWorkflow } from "@medusajs/medusa/core-flows"
import type { StaffRole } from "../../lib/staff"
import { STAFF_ROLES_MODULE } from "../../modules/staff-roles"
import type StaffRolesModuleService from "../../modules/staff-roles/service"

interface Previous {
  user_id: string
  role: StaffRole
  assigned_by: string | null
}

/** The member's role taken first (the last owner keeps theirs); undone, it comes back. */
const takeRoleStep = createStep(
  "staff-take-role",
  async (userId: string, { container }) => {
    const roles = container.resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
    const [row] = await roles.listStaffRoles(
      { user_id: userId },
      { select: ["role", "assigned_by"], take: 1 }
    )
    await roles.removeRole(userId)
    return new StepResponse<void, Previous | null>(
      undefined,
      row ? { user_id: userId, role: row.role, assigned_by: row.assigned_by } : null
    )
  },
  async (previous: Previous | null | undefined, { container }) => {
    if (previous) {
      await container
        .resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
        .setRole(previous.user_id, previous.role, previous.assigned_by)
    }
  }
)

/**
 * A member leaves the staff (F12.6, adr/0040 §4): their role, then their
 * user and login. Their open session reaches nothing from the next request
 * on: a user without a role is refused.
 */
export const removeStaffMemberWorkflow = createWorkflow(
  "staff-remove-member",
  (input: WorkflowData<{ user_id: string }>) => {
    takeRoleStep(input.user_id)
    removeUserAccountWorkflow.runAsStep({ input: { userId: input.user_id } })
    return new WorkflowResponse(input.user_id)
  }
)
