import type { MedusaContainer } from "@medusajs/framework/types"
import type { AiTask } from "../../lib/ai/registry/tasks"
import type { AiConnection, AiFlags } from "../../lib/ai/select"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { isAiCredentialProvider } from "../../modules/integration-credentials/providers-ai"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { AI_OWN_KEYS, AI_REVIEWS } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

type Resolver = Pick<MedusaContainer, "resolve">

/**
 * What the AI core reads of the shop to choose a service (adr/0071 §4,
 * §6): each AI account reduced to its state (never a secret, nor part of
 * one), and which ways of paying the package opens. The services list
 * and a suggestion's choice both read them here and decide with
 * `usableServices` alone.
 */
export async function aiConnectionsOf(container: Resolver): Promise<AiConnection[]> {
  const statuses = await container
    .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    .describeAll()
  return statuses.flatMap((status) =>
    isAiCredentialProvider(status.provider) && status.state !== "not_configured"
      ? [{ provider: status.provider, status: status.state }]
      : []
  )
}

/** Whether the task's own tenant flag (`AiTask.flag`) is on; a task without one always is. */
export async function taskFlagOpen(
  container: Resolver,
  task: Pick<AiTask, "flag">
): Promise<boolean> {
  return task.flag === undefined
    ? true
    : container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .isFeatureEnabled(task.flag)
}

/**
 * The message key of a task asked while its own flag is off: `ai.reviews`
 * says where to turn it on (Settings > AI); any other flag is the shop's
 * feature itself (e.g. `marketing.campaigns`), off as a whole.
 */
export function taskFlagOffKey(task: Pick<AiTask, "flag">): string {
  return task.flag === AI_REVIEWS ? "ai.reviews_off" : "ai.feature_off"
}

export async function aiFlagsOf(container: Resolver): Promise<AiFlags> {
  const ownKeys = await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .isFeatureEnabled(AI_OWN_KEYS)
  return { ownKeys }
}
