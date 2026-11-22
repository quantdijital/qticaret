import { generateEntityId } from "@medusajs/framework/utils"
import { marks, rows } from "./sql"
import type { Executor } from "./sql"

/** A new departure; its counters are never given, every slot starts empty. */
export interface SlotInput {
  bookable_id: string
  starts_at: Date
  ends_at?: Date | null | undefined
  capacity: number
  status?: "open" | "closed" | "cancelled" | undefined
  price_adjustments?: Record<string, number> | null | undefined
}

/** Writes new slots with `sold` and `held` at 0; their ids, in the order given. */
export async function createSlots(manager: Executor, slots: SlotInput[]): Promise<string[]> {
  if (slots.length === 0) {
    return []
  }
  const ids = slots.map(() => generateEntityId(undefined, "bkslot"))
  // The capacity is checked at the route; the table's checks keep it at 0 or more
  const params = slots.flatMap((slot, index) => [
    ids[index],
    slot.bookable_id,
    slot.starts_at,
    slot.ends_at ?? null,
    slot.capacity,
    slot.status ?? "open",
    slot.price_adjustments ? JSON.stringify(slot.price_adjustments) : null,
  ])
  await manager.execute(
    `INSERT INTO booking_slot
       (id, bookable_id, starts_at, ends_at, capacity, sold, held, status, price_adjustments,
        created_at, updated_at)
     VALUES ${slots.map(() => "(?, ?, ?, ?, ?, 0, 0, ?, ?::jsonb, now(), now())").join(", ")}`,
    params
  )
  return ids
}

/**
 * Removes slots nothing was sold or held on (a new slot undone); one a
 * cart or order has reached since is kept, its counters whole. The ids
 * removed.
 */
export async function deleteEmptySlots(manager: Executor, ids: string[]): Promise<string[]> {
  if (ids.length === 0) {
    return []
  }
  const sorted = [...new Set(ids)].sort()
  const gone = await rows(
    manager,
    `DELETE FROM booking_slot
      WHERE id IN (${marks(sorted.length)}) AND sold = 0 AND held = 0
     RETURNING id`,
    sorted
  )
  return gone.map((row) => String(row["id"]))
}
