import { ValidationError } from "../../lib/errors"
import { asInt, rows } from "./sql"
import type { Executor, SlotUnits } from "./sql"

/**
 * The shopper behind a hold (adr/0076 Ek takip M1): the address as a keyed
 * hash, never the address, and how many places its live holds may keep on
 * one departure (`clientSlotCap`: a few per-cart shares of that departure).
 */
export interface HoldClient {
  hash: string
  maxPerSlot: number
}

// Live places one address may hold over every departure at once: a few
// families' carts, never a script's many carts filling a season
export const CLIENT_LIVE_UNITS = 60

// Carts' shares one address may hold on one departure: an address is often
// many households at once (mobile CGNAT, a hotel's, school's or office's
// network), so it gets a few carts' worth, never only one (adr/0076 Ek
// takip M1: shared addresses against one person locking a departure)
export const CLIENT_CARTS_PER_SLOT = 3

/**
 * The most one address's live holds may keep on a departure: a few carts'
 * shares (`cartShareOf`), never past the departure's own places.
 */
export const clientSlotCap = (capacity: number, cartShare: number): number =>
  Math.min(capacity, CLIENT_CARTS_PER_SLOT * cartShare)

/** The advisory lock key of one address's holds. */
export const clientLockKey = (hash: string): string => `booking:client:${hash}`

const total = (units: ReadonlyMap<string, number>): number =>
  [...units.values()].reduce((sum, value) => sum + value, 0)

/**
 * The most a slot raised by this change may be set to when the change
 * goes past the address's share, or null when it fits. `own`: the cart's
 * live places per slot now; `others`: the address's other carts' live
 * places per slot; `wanted`: the cart's places per slot after the change
 * (slots not named keep theirs). Only raising is ever refused: a slot
 * lowered or kept, or a change that lowers the total, passes.
 */
export function clientShareCap(
  own: ReadonlyMap<string, number>,
  others: ReadonlyMap<string, number>,
  wanted: readonly SlotUnits[],
  maxPerSlot: number,
  liveUnits = CLIENT_LIVE_UNITS
): number | null {
  const after = new Map(own)
  for (const { slotId, units } of wanted) {
    after.set(slotId, units)
  }
  const before = total(others) + total(own)
  const overall = total(others) + total(after)
  // Places past the overall cap this change adds (0 when it lowers the total or fits)
  const excess = overall > before && overall > liveUnits ? overall - Math.max(before, liveUnits) : 0
  let allowed: number | null = null
  for (const { slotId, units } of wanted) {
    const now = own.get(slotId) ?? 0
    if (units <= now) {
      continue
    }
    const perSlot = maxPerSlot - (others.get(slotId) ?? 0)
    const cap = Math.max(now, Math.min(perSlot, units - excess))
    if (units > cap) {
      allowed = Math.min(allowed ?? cap, cap)
    }
  }
  return allowed
}

/**
 * Refuses (`booking.client_share`, with the most the departure may be set
 * to) a change that would let one address's live holds keep more than its
 * share of a slot or more than `CLIENT_LIVE_UNITS` over all slots. Takes
 * the address's advisory lock to the transaction's end before any hold or
 * slot row (adr/0076 Ek lock order: this lock, hold rows, then slots by
 * id): its carts asking at once count one after the other, never both
 * against the same total. The cart's own live hold counts as the
 * address's (this change tags it so); expired holds keep nothing.
 */
export async function assertClientShare(
  manager: Executor,
  cartId: string,
  client: HoldClient,
  wanted: readonly SlotUnits[]
): Promise<void> {
  await manager.execute("SELECT pg_advisory_xact_lock(hashtext(?))", [clientLockKey(client.hash)])
  const live = await rows(
    manager,
    `SELECT h.cart_id = ? AS own, hs.slot_id, hs.units
       FROM booking_hold h
       JOIN booking_hold_slot hs ON hs.hold_id = h.id AND hs.deleted_at IS NULL
      WHERE (h.client_hash = ? OR h.cart_id = ?)
        AND h.deleted_at IS NULL AND h.expires_at > now()`,
    [cartId, client.hash, cartId]
  )
  const own = new Map<string, number>()
  const others = new Map<string, number>()
  for (const row of live) {
    const into = row["own"] === true ? own : others
    const slotId = String(row["slot_id"])
    into.set(slotId, (into.get(slotId) ?? 0) + asInt(row["units"]))
  }
  const allowed = clientShareCap(own, others, wanted, client.maxPerSlot)
  if (allowed !== null) {
    throw new ValidationError("booking.client_share", {
      field: "items",
      values: { max: String(allowed) },
    })
  }
}
