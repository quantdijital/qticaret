import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import {
  aiCreditSettingsOf,
  saveAiCreditSettings,
  unrouteService,
} from "../ai-credits/platform-settings"
import type { AiCreditPlatformSettings, AiSettingsChange } from "../ai-credits/platform-settings"
import { providerKeysHeld } from "./keys"
import { PartlyDoneError } from "./partly-done"
import { checkedRouting } from "./routing"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The owner's settings change, its routing held to the services whose key
 * the platform holds (P3d): a capability routed to a service with no key
 * is refused `cp.ai_route_no_key` (409, api/http/ai-conflicts.ts) and
 * nothing is saved, as a key taken away takes its routing with it
 * (`unrouteService`). A change without routing is saved as it is.
 *
 * A key retired while this ran (after the check, before the save
 * committed, and after the delete's own second unroute: `deleteProviderKey`)
 * would leave a routing to a keyless service: the keys are read again
 * once saved, and a routing to one no longer held is taken out (P6b). The
 * answer is then the settings as they stand, without that routing.
 *
 * Once saved, a failure of that second read or its cleanup throws
 * `PartlyDoneError` with the change as saved: the save stands, the audit
 * row says so, the answer is still the error.
 */
export async function saveAiSettingsWithKeys(
  container: Container,
  change: AiSettingsChange,
  actor: string
): Promise<Saved> {
  // The table's own refusals (an unknown service, a model off it) come first, as before
  const routes = Object.values(change.routing === undefined ? {} : checkedRouting(change.routing))
  if (routes.length === 0) {
    return await saveAiCreditSettings(container, change, actor)
  }
  const held = await providerKeysHeld(container)
  if (routes.some((route) => !held.has(route.service))) {
    throw new MedusaError(MedusaError.Types.CONFLICT, "cp.ai_route_no_key")
  }
  const saved = await saveAiCreditSettings(container, change, actor)
  try {
    return await keyedOnly(container, saved, actor)
  } catch (error) {
    // Saved already: the audit row keeps the change as saved (`notingPartlyDone`)
    throw new PartlyDoneError(saved, "recheck_keys", error)
  }
}

interface Saved {
  before: AiCreditPlatformSettings
  after: AiCreditPlatformSettings
}

/** The saved settings, a routing to a service whose key is no longer held taken out. */
async function keyedOnly(container: Container, saved: Saved, actor: string): Promise<Saved> {
  const heldNow = await providerKeysHeld(container)
  const routed = new Set(Object.values(saved.after.routing).map((route) => route.service))
  const gone = [...routed].filter((service) => !heldNow.has(service))
  if (gone.length === 0) {
    return saved
  }
  for (const service of gone) {
    await unrouteService(container, service, actor)
  }
  return { before: saved.before, after: await aiCreditSettingsOf(container) }
}
