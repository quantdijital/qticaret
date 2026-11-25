import { AI_GATEWAY_MAX_IN_FLIGHT, AI_GATEWAY_MAX_IN_FLIGHT_PER_SHOP } from "./limits"

/**
 * The gateway's calls in flight (security review of P3b O2): a shop holds
 * at most `AI_GATEWAY_MAX_IN_FLIGHT_PER_SHOP` at once and the process at
 * most `AI_GATEWAY_MAX_IN_FLIGHT`, so one shop cannot hold the platform's
 * provider quota or this process's sockets and memory. Counted in this
 * process only (each instance its own share, as the rate limiter's local
 * fallback is); a call past either is refused before any credit is taken.
 * The slot is given back by the caller's `finally`, whatever happens to
 * the call or the shop's connection.
 */

const perShop = new Map<string, number>()
let total = 0

/** A slot for one call, or null: the shop or the process is at its limit. */
export function holdCallSlot(tenantId: string): (() => void) | null {
  const held = perShop.get(tenantId) ?? 0
  if (held >= AI_GATEWAY_MAX_IN_FLIGHT_PER_SHOP || total >= AI_GATEWAY_MAX_IN_FLIGHT) {
    return null
  }
  perShop.set(tenantId, held + 1)
  total += 1
  let given = false
  return () => {
    if (given) {
      return
    }
    given = true
    total -= 1
    const left = (perShop.get(tenantId) ?? 1) - 1
    if (left > 0) {
      perShop.set(tenantId, left)
    } else {
      perShop.delete(tenantId)
    }
  }
}

/** The calls in flight now: in all, and for `tenantId`. */
export const callsInFlight = (tenantId?: string): number =>
  tenantId === undefined ? total : (perShop.get(tenantId) ?? 0)

/** Tests only: forget every slot. */
export function resetCallSlots(): void {
  perShop.clear()
  total = 0
}
