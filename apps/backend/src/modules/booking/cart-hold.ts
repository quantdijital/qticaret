import { asInt, rows, unitsBySlot } from "./sql"
import type { Executor, SlotUnits } from "./sql"

/** A cart's hold as it stands: whether it is still live, and its places per slot. */
export interface CartHold {
  hold_id: string
  expires_at: Date
  /** `expires_at` is still ahead (the database's clock); an expired one keeps nothing. */
  live: boolean
  slots: SlotUnits[]
}

/** The cart's hold with its slots, or null when it holds nothing. Reads only. */
export async function cartHold(manager: Executor, cartId: string): Promise<CartHold | null> {
  const [hold] = await rows(
    manager,
    `SELECT id, expires_at, expires_at > now() AS live
       FROM booking_hold WHERE cart_id = ? AND deleted_at IS NULL`,
    [cartId]
  )
  if (!hold) {
    return null
  }
  const holdId = String(hold["id"])
  const slots = await rows(
    manager,
    `SELECT slot_id, units FROM booking_hold_slot WHERE hold_id = ? AND deleted_at IS NULL`,
    [holdId]
  )
  return {
    hold_id: holdId,
    expires_at: new Date(hold["expires_at"] as string | Date),
    live: hold["live"] === true,
    slots: unitsBySlot(slots).filter((slot) => asInt(slot.units) > 0),
  }
}
