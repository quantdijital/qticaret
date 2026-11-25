import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { CountedLimitKey } from "@qticaret/types/control-plane"
import {
  countOrdersThisMonth,
  countProducts,
  countStaff,
  draftsThisMonth,
  megabytesOf,
  storedBytes,
} from "../control-plane/usage"
import { registerProcessCache } from "../cache/process-caches"

type Resolver = Pick<MedusaContainer, "resolve">

/**
 * What the shop uses of each limit (adr/0061 §5.3, Ek C14), from the usage
 * report's own counters (C13), so the panel, the checks and the control
 * plane read the same numbers. One exception: a team seat is a member or
 * an invitation still open, so invitations cannot run past the limit
 * before anyone accepts. A grant (the AI free credits, adr/0085 K5) is no
 * use of the shop's: it is never counted here.
 */

/** Open invitations: not expired (Medusa deletes one as it is accepted, workflows/staff/invites.ts). */
export const openInvites = (container: Resolver, now: Date): Promise<number> =>
  container
    .resolve(Modules.USER)
    // Medusa types the invites' filter as the users' one; the invite's own column is meant
    .listAndCountInvites({ expires_at: { $gt: now } } as never, { select: ["id"], take: 1 })
    .then(([, count]) => count)

export interface Usage {
  used: number | null
  /** Team seats only: the open invitations counted in `used`. */
  pending?: number
}

/** One limit's use, counted now; null where the shop keeps no count (custom domains, F16.7). */
export async function countUsage(
  container: Resolver,
  key: CountedLimitKey,
  now: Date
): Promise<Usage> {
  switch (key) {
    case "products":
      return { used: await countProducts(container) }
    case "orders_per_month":
      return { used: await countOrdersThisMonth(container, now) }
    case "staff": {
      const [members, pending] = await Promise.all([
        countStaff(container),
        openInvites(container, now),
      ])
      return { used: members + pending, pending }
    }
    case "storage_mb":
      return { used: megabytesOf(await storedBytes(container)) }
    case "llm_credits_per_month":
      return { used: await draftsThisMonth(container, now) }
    case "custom_domains":
      return { used: null }
  }
}

/** How long a read for the panel may be reused (the checks always count afresh). */
export const USAGE_CACHE_MS = 10_000

const cache = new Map<CountedLimitKey, { at: number; usage: Usage }>()
// Forgotten per spec file of a bundled test run
registerProcessCache(() => {
  cache.clear()
})

/**
 * A limit's use for the panel's reading, kept for `USAGE_CACHE_MS` in this
 * process (cheap counts, short cache, adr/0061 §5.3). The shop's own
 * guarded writes forget the entry (`forgetUsage`), so its screen sees them.
 */
export async function cachedUsage(
  container: Resolver,
  key: CountedLimitKey,
  now: Date
): Promise<Usage> {
  const kept = cache.get(key)
  if (kept && now.getTime() - kept.at >= 0 && now.getTime() - kept.at < USAGE_CACHE_MS) {
    return kept.usage
  }
  const usage = await countUsage(container, key, now)
  cache.set(key, { at: now.getTime(), usage })
  return usage
}

/** Drops a kept count after a write that changes it. */
export function forgetUsage(key?: CountedLimitKey): void {
  if (key === undefined) {
    cache.clear()
  } else {
    cache.delete(key)
  }
}
