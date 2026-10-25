import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"

/**
 * First step of a flow behind a feature flag (adr/0012): when the flag is
 * off the workflow stops before doing anything. Subscribers and jobs check
 * `isFeatureEnabled` themselves and return early.
 */
export const assertFeatureEnabledStep = createStep(
  "platform-settings-assert-feature",
  async (key: string, { container }) => {
    const service = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    if (!(await service.isFeatureEnabled(key))) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "features.disabled")
    }
    return new StepResponse(true)
  }
)
