import { randomUUID } from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { screenFeatures } from "../../../lib/ai/assistant/screens"
import { ASSISTANT_TOOLS } from "../../../lib/ai/assistant/tools"
import { aiValidationError } from "../../../lib/ai/errors"
import { ASSISTANT_TASK } from "../../../lib/ai/registry/assistant-tasks"
import { verifiedToolCalls } from "../../../lib/ai/registry/services"
import { chooseService, usableServices } from "../../../lib/ai/select"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { STAFF_ROLES_MODULE } from "../../../modules/staff-roles"
import type StaffRolesModuleService from "../../../modules/staff-roles/service"
import { aiConnectionsOf, aiFlagsOf, aiServicesFor, taskFlagOpen } from "../connections"

/**
 * The role, the service and the flags that narrow the screens and tools
 * (adr/0079 §2); the platform's credits after the shop's own (adr/0085
 * K8), and the turn's operation.
 */
export const assistantAccessStep = createStep(
  "ai-assistant-access",
  async (input: { user_id: string; service?: string | null }, { container }) => {
    const role = await container
      .resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
      .roleOf(input.user_id)
    if (role === null || !ASSISTANT_TASK.roles.includes(role)) {
      throw new MedusaError(MedusaError.Types.FORBIDDEN, "staff.forbidden")
    }
    if (!(await taskFlagOpen(container, ASSISTANT_TASK))) {
      throw aiValidationError("ai.assistant_off")
    }
    const flags = await aiFlagsOf(container)
    if (!flags.ownKeys && flags.platformCredits !== true) {
      throw new MedusaError(MedusaError.Types.FORBIDDEN, "ai.own_keys_not_in_plan")
    }
    // Only a service whose tool calling is verified in the registry (adr/0079 §2)
    const usable = usableServices(
      ASSISTANT_TASK,
      await aiConnectionsOf(container),
      flags,
      await aiServicesFor(flags)
    ).filter((service) => verifiedToolCalls(service) !== null)
    if (usable.length === 0) {
      throw aiValidationError("ai.assistant_no_tool_service")
    }
    const choice = chooseService({ task: ASSISTANT_TASK, usable, requested: input.service })
    if (!choice.ok) {
      throw aiValidationError(choice.error)
    }
    const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const named = [
      ...screenFeatures(),
      ...ASSISTANT_TOOLS.flatMap((tool) => (tool.flag ? [tool.flag] : [])),
    ]
    const features: string[] = []
    for (const key of new Set(named)) {
      if (await settings.isFeatureEnabled(key)) {
        features.push(key)
      }
    }
    return new StepResponse({
      role,
      service: choice.service.id,
      funding: choice.service.funding,
      // The turn is one operation (adr/0085 K3): every model call of its loop shares it
      operation: randomUUID(),
      features,
    })
  }
)
