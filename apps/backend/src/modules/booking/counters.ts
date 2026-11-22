import { generateEntityId } from "@medusajs/framework/utils"
import { ConflictError, ValidationError } from "../../lib/errors"
import {
  asInt,
  giveBackHeld,
  normalizeUnits,
  releaseExpired,
  rows,
  takeUnits,
  unitsBySlot,
} from "./sql"
import type { Executor, SlotUnits } from "./sql"

/** A cart's hold as it stands after a change; null: it holds nothing now. */
export interface HoldState {
  hold_id: string
  expires_at: Date
}

// The longest a hold is set or extended to at once (minutes)
export const MAX_HOLD_MINUTES = 120

function checkMinutes(minutes: number): void {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_HOLD_MINUTES) {
    throw new ValidationError("booking.hold_minutes_invalid", { field: "hold_minutes" })
  }
}

/**
 * Sets how many places a cart holds on each slot named (0 gives a slot
 * back; slots not named keep theirs), the hold ending `minutes` from now.
 * Order of locks, the same in every run: the expired holds on these slots
 * (released first, so a late sweep never blocks a place), then the cart's
 * hold row, then the slots in id order. Any slot refused undoes the whole
 * call (the transaction).
 */
export async function holdUnits(
  manager: Executor,
  cartId: string,
  items: readonly SlotUnits[],
  minutes: number
): Promise<HoldState | null> {
  checkMinutes(minutes)
  const wanted = normalizeUnits(items, 0)
  await releaseExpired(
    manager,
    null,
    wanted.map((item) => item.slotId)
  )
  const [hold] = await rows(
    manager,
    `INSERT INTO booking_hold (id, cart_id, expires_at, created_at, updated_at)
     VALUES (?, ?, now() + make_interval(mins => ?), now(), now())
     ON CONFLICT (cart_id) WHERE deleted_at IS NULL
     DO UPDATE SET expires_at = EXCLUDED.expires_at, updated_at = now()
     RETURNING id, expires_at`,
    [generateEntityId(undefined, "bkhold"), cartId, minutes]
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
  return { hold_id: holdId, expires_at: new Date(hold?.["expires_at"] as string | Date) }
}

/**
 * Pushes a live hold's end to at least `minutes` from now (payment
 * started, §5); never shortens it. An expired one is not brought back
 * (its places may already be someone else's): null.
 */
export async function extendHold(
  manager: Executor,
  cartId: string,
  minutes: number
): Promise<HoldState | null> {
  checkMinutes(minutes)
  const [hold] = await rows(
    manager,
    `UPDATE booking_hold
        SET expires_at = GREATEST(expires_at, now() + make_interval(mins => ?)), updated_at = now()
      WHERE cart_id = ? AND deleted_at IS NULL AND expires_at > now()
     RETURNING id, expires_at`,
    [minutes, cartId]
  )
  return hold
    ? { hold_id: String(hold["id"]), expires_at: new Date(hold["expires_at"] as string | Date) }
    : null
}

/**
 * Turns a hold into an order's booking: each slot's places move from
 * `held` to `sold` (already counted, so capacity cannot refuse it), the
 * hold goes and the booking is written, in one transaction. Again for the
 * same hold and order: the booking it made, nothing changed (`created`
 * false); for another order, refused.
 */
export async function confirmHold(
  manager: Executor,
  holdId: string,
  orderId: string
): Promise<{ booking_id: string; created: boolean }> {
  const [hold] = await rows(
    manager,
    `SELECT id FROM booking_hold WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
    [holdId]
  )
  if (!hold) {
    // Gone: confirmed already (the run before us committed), released or swept
    const [made] = await rows(
      manager,
      `SELECT id, order_id FROM booking WHERE hold_id = ? AND deleted_at IS NULL`,
      [holdId]
    )
    if (!made) {
      throw new ConflictError("booking.hold_missing")
    }
    if (made["order_id"] !== orderId) {
      throw new ConflictError("booking.hold_used")
    }
    return { booking_id: String(made["id"]), created: false }
  }
  const units = unitsBySlot(
    await rows(
      manager,
      `DELETE FROM booking_hold_slot WHERE hold_id = ? RETURNING slot_id, units`,
      [holdId]
    )
  )
  for (const { slotId, units: count } of units) {
    await manager.execute(
      `UPDATE booking_slot SET held = held - ?, sold = sold + ?, updated_at = now() WHERE id = ?`,
      [count, count, slotId]
    )
  }
  await manager.execute(`DELETE FROM booking_hold WHERE id = ?`, [holdId])
  const bookingId = generateEntityId(undefined, "bkng")
  await manager.execute(
    `INSERT INTO booking (id, order_id, line_item_id, hold_id, status, created_at, updated_at)
     VALUES (?, ?, NULL, ?, 'confirmed', now(), now())`,
    [bookingId, orderId, holdId]
  )
  if (units.length > 0) {
    await manager.execute(
      `INSERT INTO booking_slot_use (id, booking_id, slot_id, units, created_at, updated_at)
       VALUES ${units.map(() => "(?, ?, ?, ?, now(), now())").join(", ")}`,
      units.flatMap(({ slotId, units: count }) => [
        generateEntityId(undefined, "bkuse"),
        bookingId,
        slotId,
        count,
      ])
    )
  }
  return { booking_id: bookingId, created: true }
}

/**
 * Cancels a confirmed booking and gives its places back (`sold` falls).
 * Whether it changed: a booking cancelled already (or completed) is left.
 */
export async function cancelBooking(manager: Executor, bookingId: string): Promise<boolean> {
  const changed = await rows(
    manager,
    `UPDATE booking SET status = 'cancelled', updated_at = now()
      WHERE id = ? AND deleted_at IS NULL AND status = 'confirmed'
     RETURNING id`,
    [bookingId]
  )
  if (changed.length === 0) {
    const [known] = await rows(
      manager,
      `SELECT id FROM booking WHERE id = ? AND deleted_at IS NULL`,
      [bookingId]
    )
    if (!known) {
      throw new ValidationError("booking.unknown", { field: "booking_id" })
    }
    return false
  }
  const uses = unitsBySlot(
    await rows(
      manager,
      `SELECT slot_id, units FROM booking_slot_use WHERE booking_id = ? AND deleted_at IS NULL`,
      [bookingId]
    )
  )
  for (const { slotId, units } of uses) {
    await manager.execute(
      `UPDATE booking_slot SET sold = sold - ?, updated_at = now() WHERE id = ?`,
      [units, slotId]
    )
  }
  return true
}

/** A slot's own fields staff change; counters are never among them. */
export interface SlotChanges {
  capacity?: number | undefined
  status?: "open" | "closed" | "cancelled" | undefined
  starts_at?: Date | undefined
  ends_at?: Date | null | undefined
  price_adjustments?: Record<string, number> | null | undefined
}

/**
 * Changes a slot in one statement, its counters untouched: a capacity
 * below the places sold and held (expired holds released first) is
 * refused. Whether the slot exists.
 */
export async function updateSlot(
  manager: Executor,
  slotId: string,
  changes: SlotChanges
): Promise<boolean> {
  const sets: string[] = []
  const params: unknown[] = []
  const set = (column: string, value: unknown, cast = "") => {
    sets.push(`${column} = ?${cast}`)
    params.push(value)
  }
  if (changes.capacity !== undefined) {
    await releaseExpired(manager, null, [slotId])
    set("capacity", changes.capacity)
  }
  if (changes.status !== undefined) {
    set("status", changes.status)
  }
  if (changes.starts_at !== undefined) {
    set("starts_at", changes.starts_at)
  }
  if (changes.ends_at !== undefined) {
    set("ends_at", changes.ends_at)
  }
  if (changes.price_adjustments !== undefined) {
    set(
      "price_adjustments",
      changes.price_adjustments === null ? null : JSON.stringify(changes.price_adjustments),
      "::jsonb"
    )
  }
  const guard = changes.capacity === undefined ? "" : "AND sold + held <= ?"
  const updated = await rows(
    manager,
    `UPDATE booking_slot SET ${[...sets, "updated_at = now()"].join(", ")}
      WHERE id = ? AND deleted_at IS NULL ${guard} RETURNING id`,
    [...params, slotId, ...(changes.capacity === undefined ? [] : [changes.capacity])]
  )
  if (updated.length > 0) {
    return true
  }
  const [slot] = await rows(
    manager,
    `SELECT id FROM booking_slot WHERE id = ? AND deleted_at IS NULL`,
    [slotId]
  )
  if (slot && changes.capacity !== undefined) {
    throw new ValidationError("booking.capacity_below_sold", { field: "capacity" })
  }
  return false
}
