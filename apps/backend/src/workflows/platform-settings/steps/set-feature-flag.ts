import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"

export interface SetFeatureFlagInput {
  key: string
  enabled: boolean
  actor_id: string | null
}

export const setFeatureFlagStep = createStep(
  "platform-settings-set-feature",
  async (input: SetFeatureFlagInput, { container }) => {
    const service = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const change = await service.setFeature(input.key, input.enabled, input.actor_id)
    return new StepResponse(
      { before: change.before, after: change.after },
      { key: input.key, previousOverride: change.previousOverride }
    )
  },
  async (saved: { key: string; previousOverride: boolean | null } | undefined, { container }) => {
    if (!saved) {
      return
    }
    const service = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    await service.restoreFeature(saved.key, saved.previousOverride)
  }
)
