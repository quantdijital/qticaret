import { sectorPack } from "@qticaret/sector-packs"
import type { CommandResult } from "./provisioner"

/**
 * The tests' shop for `load-samples` (beside `fake-provisioner.ts`): which
 * shops have which pack's samples, on `globalThis` as the fake's own state.
 * As the shop's script: no samples for the pack, or a pack the shop was not
 * given, prints `unknown_samples` (exit 0); a set already there prints
 * `already_loaded`; otherwise the set's counts.
 */

const KEY = Symbol.for("qticaret.control-plane.fake-samples")

/** Tenant id → the packs whose samples its shop has. */
export function fakeSamples(): Map<string, Set<string>> {
  const holder = globalThis as unknown as Record<symbol, Map<string, Set<string>> | undefined>
  holder[KEY] ??= new Map()
  return holder[KEY]
}

const answer = (result: unknown): CommandResult => ({
  ok: true,
  exit_code: 0,
  timed_out: false,
  duration_ms: 1,
  result,
})

export function loadFakeSamples(
  tenantId: string,
  pack: string,
  packsApplied: Readonly<Record<string, number>>
): CommandResult {
  const samples = sectorPack(pack)?.samples
  if (!samples || !Object.hasOwn(packsApplied, pack)) {
    return answer({ status: "unknown_samples" })
  }
  const loaded = fakeSamples().get(tenantId) ?? new Set<string>()
  if (loaded.has(pack)) {
    return answer({ status: "already_loaded" })
  }
  loaded.add(pack)
  fakeSamples().set(tenantId, loaded)
  return answer({
    status: "loaded",
    pack,
    products: samples.products.length,
    categories_made: samples.categories.length,
    categories_opened: 0,
  })
}
