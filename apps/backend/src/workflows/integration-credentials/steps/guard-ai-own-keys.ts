import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { AI_OWN_KEYS } from "../../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import type { CredentialProviderName } from "../../../modules/integration-credentials/providers"
import { isAiCredentialProvider } from "../../../modules/integration-credentials/providers-ai"

/**
 * An AI service is connected and checked only while the package has the
 * "own key" way (`ai.own_keys`, adr/0071 §6). Off: 403
 * `ai.own_keys_not_in_plan`, before the provider is asked or anything is
 * stored. A stored key is not touched: it waits, unused, for the package
 * to allow it again. Removing one stays open. Other providers pass.
 */
export const guardAiOwnKeysStep = createStep(
  "integration-credentials-guard-ai-own-keys",
  async (provider: CredentialProviderName, { container }) => {
    if (isAiCredentialProvider(provider)) {
      const enabled = await container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .isFeatureEnabled(AI_OWN_KEYS)
      if (!enabled) {
        throw new MedusaError(MedusaError.Types.FORBIDDEN, "ai.own_keys_not_in_plan")
      }
    }
    return new StepResponse(true)
  }
)
