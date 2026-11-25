import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { aiTargetServiceIds } from "@qticaret/types/control-plane"
import { unrouteService } from "../ai-credits/platform-settings"
import { PLATFORM_OWNER, aiProviderKeyName, aiProviderOfKeyName } from "../vault/secret-names"
import { vaultIn } from "../../workflows/modules"
import { PartlyDoneError } from "./partly-done"
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
  // Only the keys' own names, not the platform's every record (PR #371
  // D2); newest version first within a name: the first seen is in force
  const rows = await vaultIn(container).listSecretRecords(
    { owner: PLATFORM_OWNER, name: keyedServices().map(aiProviderKeyName) },
    {
      select: ["name", "version", "created_at"],
      order: { name: "ASC", version: "DESC" },
      take: KEY_ROWS_MAX,
    }
  )
  for (const row of rows) {
    const service = aiProviderOfKeyName(row.name)
    if (service !== null && !held.has(service)) {
      held.set(service, { version: row.version, written_at: row.created_at })
    }
  }
  return held
}

/** Live versions read at most: one a service since a write retires the older (D1). */
const KEY_ROWS_MAX = 200

/** The services a key may be held for now, in the shared table's order. */
export function keyedServices(): readonly string[] {
  return aiTargetServiceIds(process.env["NODE_ENV"])
}

function knownService(service: string): string {
  if (!isKnownService(service)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.ai_service_unknown")
  }
  return service
}

/**
 * A new version of the service's key sealed, the older ones retired in the
 * same transaction (a replaced key is not kept sealed); its metadata back.
 * The value goes to the vault and nowhere else: no answer, error or log
 * carries it.
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
    retireOlder: true,
  })
  return { version: meta.version, written_at: meta.created_at }
}

/**
 * The service's key retired, every version (emptied, its numbers kept: a
 * key written later is not "version 1" again), and every routing to it
 * taken out first: from the moment the key is gone nothing routes there
 * (a failure between the two leaves the key unrouted, never routed and
 * keyless). Whether a key was held and the capabilities unrouted come back.
 * Retiring is not revoking: a leaked key is revoked at the provider first.
 *
 * The routing is taken out a second time once the key is retired (P6b): a
 * settings save that saw the key held before the retire may have written
 * its routing between the first pass and the retire. One advisory lock
 * cannot hold the two apart: the routing row (ai-credits module) and the
 * key (vault module) are each changed in their own module's transaction.
 * A save that commits after this second pass checks the keys again itself
 * (`saveAiSettingsWithKeys`), so nothing stays routed to a keyless service.
 *
 * A step failing once something has changed (the routing taken out, the
 * key retired) throws `PartlyDoneError` with what is done, so the audit
 * row says it (`notingPartlyDone`); a first unroute failing changed
 * nothing and throws as it is.
 */
export async function deleteProviderKey(
  container: Container,
  service: string,
  actor: string
): Promise<ProviderKeyDeletion> {
  const id = knownService(service)
  let done: ProviderKeyDeletion = {
    deleted: false,
    unrouted: await unrouteService(container, id, actor),
  }
  // The step under way, named in the audit row when it fails (no key held retires nothing)
  let step: "retire" | "unroute_again" = "retire"
  try {
    done = {
      ...done,
      deleted: await vaultIn(container).retireSecret(PLATFORM_OWNER, aiProviderKeyName(id)),
    }
    step = "unroute_again"
    const late = await unrouteService(container, id, actor)
    return { ...done, unrouted: [...new Set([...done.unrouted, ...late])] }
  } catch (error) {
    if (!done.deleted && done.unrouted.length === 0) {
      throw error
    }
    throw new PartlyDoneError(done, step, error)
  }
}

export interface ProviderKeyDeletion {
  /** Whether a key was held and is now retired. */
  deleted: boolean
  /** The capabilities whose routing to the service was taken out. */
  unrouted: string[]
}
