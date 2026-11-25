import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { aiTargetServiceIds } from "@qticaret/types/control-plane"
import { unrouteService } from "../ai-credits/platform-settings"
import { PLATFORM_OWNER, aiProviderKeyName, aiProviderOfKeyName } from "../vault/secret-names"
import { vaultIn } from "../../workflows/modules"
import { isKnownService } from "./routing"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The AI providers' keys the platform holds (adr/0085 §2, "Güvenlik"):
 * sealed in the vault (`platform`, `ai.<service>.api_key`), written and
 * destroyed by the owner, never read back. What any caller learns is
 * whether one is held, its version and when it was written; the value is
 * opened in memory by the gateway alone (P3b).
 */

export interface ProviderKeyMeta {
  version: number
  written_at: Date
}

/** The latest key held for each service, by service id. */
export async function providerKeysHeld(
  container: Container
): Promise<Map<string, ProviderKeyMeta>> {
  const held = new Map<string, ProviderKeyMeta>()
  // Newest version first within a name: the first seen is the one in force
  for (const meta of await vaultIn(container).listSecretMeta(PLATFORM_OWNER)) {
    const service = aiProviderOfKeyName(meta.name)
    if (service !== null && !held.has(service)) {
      held.set(service, { version: meta.version, written_at: meta.created_at })
    }
  }
  return held
}

/** The services a key may be held for now, in the shared table's order. */
export const keyedServices = (): readonly string[] => aiTargetServiceIds(process.env["NODE_ENV"])

function knownService(service: string): string {
  if (!isKnownService(service)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.ai_service_unknown")
  }
  return service
}

/**
 * A new version of the service's key sealed; its metadata back. The value
 * goes to the vault and nowhere else: no answer, error or log carries it.
 */
export async function writeProviderKey(
  container: Container,
  service: string,
  value: string
): Promise<ProviderKeyMeta> {
  const meta = await vaultIn(container).putSecret({
    owner: PLATFORM_OWNER,
    name: aiProviderKeyName(knownService(service)),
    value,
  })
  return { version: meta.version, written_at: meta.created_at }
}

/**
 * The service's key destroyed, every version, and every routing to it
 * taken out first: from the moment the key is gone nothing routes there
 * (a failure between the two leaves the key unrouted, never routed and
 * keyless). Whether a key was held and the capabilities unrouted come back.
 */
export async function deleteProviderKey(
  container: Container,
  service: string,
  actor: string
): Promise<{ deleted: boolean; unrouted: string[] }> {
  const id = knownService(service)
  const unrouted = await unrouteService(container, id, actor)
  const held = (await providerKeysHeld(container)).has(id)
  if (held) {
    await vaultIn(container).destroySecret(PLATFORM_OWNER, aiProviderKeyName(id))
  }
  return { deleted: held, unrouted }
}
