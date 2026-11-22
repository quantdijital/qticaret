import { generateEntityId } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { assertClientShare } from "./client-share"
import type { HoldClient } from "./client-share"
import {
  asInt,
  giveBackHeld,
  lockSlotsFreeingExpired,
  normalizeUnits,
  rows,
  takeUnits,
} from "./sql"
import type { Executor, Row, SlotUnits } from "./sql"

/** A cart's hold as it stands after a change; null: it holds nothing now. */
export interface HoldState {
  hold_id: string
  expires_at: Date
}

// The longest a hold is set or extended to at once (minutes)
export const MAX_HOLD_MINUTES = 120
// The longest one hold lives from its start, however often it is pushed
// (minutes): places are not kept from others by extending without end
export const HOLD_LIFETIME_MINUTES = 120
// How far past its lifetime the order's completion alone may push a hold
// (minutes): the payment is taken by then; the order confirms the places
export const COMPLETION_GRACE_MINUTES = 15

function checkMinutes(minutes: number): void {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_HOLD_MINUTES) {
    throw new ValidationError("booking.hold_minutes_invalid", { field: "hold_minutes" })
  }
}

const stateOf = (hold: Row | undefined): HoldState => ({
  hold_id: String(hold?.["id"]),
  expires_at: new Date(hold?.["expires_at"] as string | Date),
})

/**
 * A new hold row for the cart, ending `minutes` from now, or its row now.
 * `clientHash` tags it with the shopper asking (null keeps the tag it has).
 */
async function openHold(
  manager: Executor,
  cartId: string,
  minutes: number,
  clientHash: string | null
): Promise<Row[]> {
  return rows(
    manager,
    `INSERT INTO booking_hold (id, cart_id, expires_at, client_hash, created_at, updated_at)
     VALUES (?, ?, now() + make_interval(mins => ?), ?, now(), now())
     ON CONFLICT (cart_id) WHERE deleted_at IS NULL
     DO UPDATE SET updated_at = now(),
                   client_hash = COALESCE(EXCLUDED.client_hash, booking_hold.client_hash)
     RETURNING id, expires_at, expires_at <= now() AS expired`,
    [generateEntityId(undefined, "bkhold"), cartId, minutes, clientHash]
  )
}

/**
 * Sets how many places a cart holds on each slot named (0 gives a slot
 * back; slots not named keep theirs), the hold ending `minutes` from now
 * but never past its lifetime. Locks (adr/0076 Ek): the cart's hold row
 * first, then every slot touched at once in id order. A hold already
 * expired is not brought back: its places go back and a new hold starts.
 * Any slot refused undoes the whole call (the transaction). `client`
 * (the storefront's booking route): the shopper's address, its live
 * holds capped before anything is locked or taken (`client-share.ts`,
 * whose advisory lock comes first of all); the hold is tagged with it.
 */
export async function holdUnits(
  manager: Executor,
  cartId: string,
  items: readonly SlotUnits[],
  minutes: number,
  client: HoldClient | null = null
): Promise<HoldState | null> {
  checkMinutes(minutes)
  const wanted = normalizeUnits(items, 0)
  if (client) {
    await assertClientShare(manager, cartId, client, wanted)
  }
  const [own] = await openHold(manager, cartId, minutes, client?.hash ?? null)
  const ownId = String(own?.["id"])
  const expired = own?.["expired"] === true
  await lockSlotsFreeingExpired(
    manager,
    wanted.map((item) => item.slotId),
    expired ? [ownId] : []
  )
  const [hold] = expired
    ? await openHold(manager, cartId, minutes, client?.hash ?? null)
    : await rows(
        manager,
        `UPDATE booking_hold
            SET expires_at = LEAST(now() + make_interval(mins => ?),
                                   created_at + make_interval(mins => ?)),
                updated_at = now()
          WHERE id = ?
         RETURNING id, expires_at`,
        [minutes, HOLD_LIFETIME_MINUTES, ownId]
      )
  const holdId = String(hold?.["id"])
  const held = new Map(
    (
      await rows(
        manager,
        `SELECT slot_id, units FROM booking_hold_slot WHERE hold_id = ? AND deleted_at IS NULL`,
        [holdId]
      )
    ).map((row) => [String(row["slot_id"]), asInt(row["units"])])
  )
  for (const { slotId, units } of wanted) {
    const delta = units - (held.get(slotId) ?? 0)
    if (delta > 0) {
      await takeUnits(manager, slotId, delta)
    } else if (delta < 0) {
      await giveBackHeld(manager, [{ slotId, units: -delta }])
    }
    if (units === 0) {
      await manager.execute(`DELETE FROM booking_hold_slot WHERE hold_id = ? AND slot_id = ?`, [
        holdId,
        slotId,
      ])
      held.delete(slotId)
    } else if (delta !== 0 || !held.has(slotId)) {
      await manager.execute(
        `INSERT INTO booking_hold_slot (id, hold_id, slot_id, units, created_at, updated_at)
         VALUES (?, ?, ?, ?, now(), now())
         ON CONFLICT (hold_id, slot_id) WHERE deleted_at IS NULL
         DO UPDATE SET units = EXCLUDED.units, updated_at = now()`,
        [generateEntityId(undefined, "bkhslot"), holdId, slotId, units]
      )
      held.set(slotId, units)
    }
  }
  if (held.size === 0) {
    await manager.execute(`DELETE FROM booking_hold WHERE id = ?`, [holdId])
    return null
  }
  return stateOf(hold)
}

/**
 * Pushes a live hold's end to at least `minutes` from now (payment
 * started, §5), never past its lifetime; never shortens it. An expired
 * one is not brought back (its places may already be someone else's):
 * null. The order's completion alone may go past the lifetime, by
 * `COMPLETION_GRACE_MINUTES` (adr/0076 Ek): a payment already taken
 * must still find its places when the order confirms them.
 */
export async function extendHold(
  manager: Executor,
  cartId: string,
  minutes: number,
  options: { completion?: boolean } = {}
): Promise<HoldState | null> {
  checkMinutes(minutes)
  const lifetime = HOLD_LIFETIME_MINUTES + (options.completion ? COMPLETION_GRACE_MINUTES : 0)
  const [hold] = await rows(
    manager,
    `UPDATE booking_hold
        SET expires_at = GREATEST(expires_at,
                                  LEAST(now() + make_interval(mins => ?),
                                        created_at + make_interval(mins => ?))),
            updated_at = now()
      WHERE cart_id = ? AND deleted_at IS NULL AND expires_at > now()
     RETURNING id, expires_at`,
    [minutes, lifetime, cartId]
  )
  return hold ? stateOf(hold) : null
}
