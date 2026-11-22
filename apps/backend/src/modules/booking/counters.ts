import { generateEntityId } from "@medusajs/framework/utils"
import { ConflictError, ValidationError } from "../../lib/errors"
import { lockSlotsFreeingExpired, rows, unitsBySlot } from "./sql"
import type { Executor } from "./sql"

export { extendHold, holdUnits, HOLD_LIFETIME_MINUTES, MAX_HOLD_MINUTES } from "./holds"
export type { HoldState } from "./holds"

/**
 * Turns a hold into an order's booking: each slot's places move from
 * `held` to `sold` (already counted, so capacity cannot refuse it), the
 * hold goes and the booking is written, in one transaction. Again for the
 * same hold and order: the booking it made, nothing changed (`created`
 * false); for another order, refused. `lineItemId`: the order's first
 * dated line, the booking's line (its other lines carry the same mark).
 */
export async function confirmHold(
  manager: Executor,
  holdId: string,
  orderId: string,
  lineItemId: string | null = null
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
     VALUES (?, ?, ?, ?, 'confirmed', now(), now())`,
    [bookingId, orderId, lineItemId, holdId]
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
    // The slot (and its expired holds' slots) locked in the one order first
    await lockSlotsFreeingExpired(manager, [slotId])
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
