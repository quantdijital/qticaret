import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { aiValidationError } from "../../../lib/ai/errors"
import { isTaskOption } from "../../../lib/ai/instructions"
import { findAiTask } from "../../../lib/ai/registry/tasks"
import { STAFF_ROLES_MODULE } from "../../../modules/staff-roles"
import type StaffRolesModuleService from "../../../modules/staff-roles/service"
import { aiFlagsOf } from "../connections"

export interface AuthorizeTaskInput {
  task: string
  option?: string | null | undefined
  user_id: string
}

/**
 * The first step of every AI task (adr/0071 §8.1), before a service is
 * chosen or any key is read: the task exists, the staff member's role may
 * ask for it (the route's rule is shared by every task, so the task's own
 * list is checked here too), and the package opens a way to pay. With
 * `ai.own_keys` off a stored key stays unused: the credentials module's
 * `read` does not look at the flag, so this step is where it holds.
 * Nothing to undo.
 */
export const authorizeTaskStep = createStep(
  "ai-authorize-task",
  async (input: AuthorizeTaskInput, { container }) => {
    const task = findAiTask(input.task)
    if (!task || !isTaskOption(task, input.option)) {
      throw aiValidationError("ai.unknown_task")
    }
    const role = await container
      .resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
      .roleOf(input.user_id)
    if (role === null || !task.roles.includes(role)) {
      throw new MedusaError(MedusaError.Types.FORBIDDEN, "staff.forbidden")
    }
    const flags = await aiFlagsOf(container)
    if (!flags.ownKeys && flags.platformCredits !== true) {
      throw new MedusaError(MedusaError.Types.FORBIDDEN, "ai.own_keys_not_in_plan")
    }
    return new StepResponse({ task: task.id, capability: task.capability })
  }
)
