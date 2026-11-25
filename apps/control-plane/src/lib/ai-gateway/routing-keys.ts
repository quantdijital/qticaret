import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { saveAiCreditSettings } from "../ai-credits/platform-settings"
import type { AiCreditPlatformSettings, AiSettingsChange } from "../ai-credits/platform-settings"
import { providerKeysHeld } from "./keys"
import { checkedRouting } from "./routing"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The owner's settings change, its routing held to the services whose key
 * the platform holds (P3d): a capability routed to a service with no key
 * is refused `cp.ai_route_no_key` (409, api/http/ai-conflicts.ts) and
 * nothing is saved, as a key taken away takes its routing with it
 * (`unrouteService`). A change without routing is saved as it is.
 */
export async function saveAiSettingsWithKeys(
  container: Container,
  change: AiSettingsChange,
  actor: string
): Promise<{ before: AiCreditPlatformSettings; after: AiCreditPlatformSettings }> {
  // The table's own refusals (an unknown service, a model off it) come first, as before
  const routes = Object.values(change.routing === undefined ? {} : checkedRouting(change.routing))
  if (routes.length > 0) {
    const held = await providerKeysHeld(container)
    if (routes.some((route) => !held.has(route.service))) {
      throw new MedusaError(MedusaError.Types.CONFLICT, "cp.ai_route_no_key")
    }
  }
  return await saveAiCreditSettings(container, change, actor)
}
