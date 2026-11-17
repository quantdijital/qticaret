import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { aiValidationError } from "../../../lib/ai/errors"
import { findAiTask } from "../../../lib/ai/registry/tasks"
import { chooseService, usableServices } from "../../../lib/ai/select"
import { AI_MODULE } from "../../../modules/ai"
import type AiModuleService from "../../../modules/ai/service"
import { aiConnectionsOf, aiFlagsOf } from "../connections"

export interface SelectServiceInput {
  task: string
  user_id: string
  /** The service the staff member picked; only when several are usable. */
  service?: string | null | undefined
}

/**
 * Which service runs the task (adr/0071 §4): the usable ones are only
 * what `usableServices` makes of the shop's accounts and the package's
 * flags, and `chooseService` picks among them. Only the service's id
 * leaves this step; its key is read where it is used (`call-service`).
 * Nothing to undo.
 */
export const selectServiceStep = createStep(
  "ai-select-service",
  async (input: SelectServiceInput, { container }) => {
    const task = findAiTask(input.task)
    if (!task) {
      throw aiValidationError("ai.unknown_task")
    }
    const [connections, flags, preference] = await Promise.all([
      aiConnectionsOf(container),
      aiFlagsOf(container),
      container.resolve<AiModuleService>(AI_MODULE).preferenceOf(input.user_id, task.id),
    ])
    const usable = usableServices(task, connections, flags)
    const choice = chooseService({ task, usable, requested: input.service, preference })
    if (!choice.ok) {
      throw aiValidationError(choice.error)
    }
    return new StepResponse({
      service: choice.service.id,
      funding: choice.service.funding,
      alternatives: choice.alternatives,
      // Several to choose from and one asked for: the picker was used, so it is remembered
      remember: usable.length > 1 && typeof input.service === "string",
    })
  }
)
