import type { MedusaContainer } from "@medusajs/framework/types"
import { aiGatewayEndpoint } from "../../lib/control-plane/ai-gateway"
import { aiCreditsStatus } from "../../lib/control-plane/ai-credits"
import { platformServiceOf } from "../../lib/ai/registry/platform-service"
import { aiServices } from "../../lib/ai/registry/services"
import type { AiService } from "../../lib/ai/registry/services"
import type { AiTask } from "../../lib/ai/registry/tasks"
import type { AiConnection, AiFlags } from "../../lib/ai/select"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { isAiCredentialProvider } from "../../modules/integration-credentials/providers-ai"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import {
  AI_OWN_KEYS,
  AI_PLATFORM_CREDITS,
  AI_REVIEWS,
} from "../../modules/platform-settings/features"
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
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [ownKeys, platformCredits] = await Promise.all([
    settings.isFeatureEnabled(AI_OWN_KEYS),
    settings.isFeatureEnabled(AI_PLATFORM_CREDITS),
  ])
  return { ownKeys, platformCredits }
}

/**
 * The platform's credits as a service, when they are "connected" (adr/0085
 * §3): the package's flag on, a control plane configured, and its status
 * saying the credits can be used now (kept 60 seconds; unreachable or
 * refused is "not connected"). Null otherwise; with the flag off nothing
 * is asked of the control plane.
 */
export async function aiPlatformServiceOf(
  flags: Pick<AiFlags, "platformCredits">
): Promise<AiService | null> {
  if (flags.platformCredits !== true || aiGatewayEndpoint() === null) {
    return null
  }
  const status = await aiCreditsStatus()
  return status.available ? platformServiceOf(status.services) : null
}

/**
 * The services a staff member's task may run on: the registry's, then
 * the platform's when connected (after the shop's own, so a shop with
 * its own key keeps it by default, adr/0085 K8). Never the storefront's
 * search: it reads `aiServices()` alone (K10).
 */
export async function aiServicesFor(flags: AiFlags): Promise<readonly AiService[]> {
  const platform = await aiPlatformServiceOf(flags)
  return platform === null ? aiServices() : [...aiServices(), platform]
}
