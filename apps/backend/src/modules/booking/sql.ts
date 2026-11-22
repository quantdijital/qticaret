import { ConflictError, ValidationError } from "../../lib/errors"

/** The module's transaction, as raw SQL needs it (`?` binds one value each). */
export interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

export type Row = Record<string, unknown>

/** Places on one slot. */
export interface SlotUnits {
  slotId: string
  units: number
}

// More places than any departure has; a typo, not a booking
export const MAX_UNITS = 10_000
// Holds swept in one statement; the next run takes the rest
export const SWEEP_BATCH = 500

export async function rows(manager: Executor, sql: string, params: unknown[]): Promise<Row[]> {
  return (await manager.execute(sql, params)) as Row[]
}

/** `?, ?, ?` for a list bound value by value (an array bound to one `?` is not a Postgres array). */
export const marks = (count: number): string => Array.from({ length: count }, () => "?").join(", ")

export const asInt = (value: unknown): number => Number(value ?? 0)

/**
 * Places asked for, slot by slot: the same slot twice is added up, and
 * the list comes back in id order, the order every statement here locks
 * slots in (two runs never wait on each other in a circle). Units are
 * whole and at least `min` (0 lets a hold give a slot back).
 */
export function normalizeUnits(items: readonly SlotUnits[], min: 0 | 1): SlotUnits[] {
  const totals = new Map<string, number>()
  for (const item of items) {
    if (!Number.isInteger(item.units) || item.units < min || item.units > MAX_UNITS) {
      throw new ValidationError("booking.units_invalid", { field: "units" })
    }
    if (typeof item.slotId !== "string" || item.slotId.length === 0) {
      throw new ValidationError("booking.slot_unknown", { field: "slot_id" })
    }
    totals.set(item.slotId, (totals.get(item.slotId) ?? 0) + item.units)
  }
  if (totals.size === 0) {
    throw new ValidationError("booking.units_invalid", { field: "units" })
  }
  return [...totals.entries()]
    .map(([slotId, units]) => {
      if (units > MAX_UNITS) {
        throw new ValidationError("booking.units_invalid", { field: "units" })
      }
      return { slotId, units }
    })
    .sort((a, b) => (a.slotId < b.slotId ? -1 : a.slotId > b.slotId ? 1 : 0))
}

/** Units added up per slot, in id order. */
export function unitsBySlot(list: Row[]): SlotUnits[] {
  const totals = new Map<string, number>()
  for (const row of list) {
    const slotId = String(row["slot_id"])
    totals.set(slotId, (totals.get(slotId) ?? 0) + asInt(row["units"]))
  }
  return [...totals.entries()]
    .map(([slotId, units]) => ({ slotId, units }))
    .sort((a, b) => (a.slotId < b.slotId ? -1 : a.slotId > b.slotId ? 1 : 0))
}

/**
 * Takes `units` places of a slot for a hold in one statement: only an
 * open slot with that many free, so two carts at once never take more
 * than there is (the row lock and the check keep `sold + held` inside the
 * capacity). Refused: closed (or gone) or full.
 */
export async function takeUnits(manager: Executor, slotId: string, units: number): Promise<void> {
  const taken = await rows(
    manager,
    `UPDATE booking_slot SET held = held + ?, updated_at = now()
      WHERE id = ? AND deleted_at IS NULL AND status = 'open' AND sold + held + ? <= capacity
     RETURNING id`,
    [units, slotId, units]
  )
  if (taken.length > 0) {
    return
  }
  const [slot] = await rows(
    manager,
    `SELECT status FROM booking_slot WHERE id = ? AND deleted_at IS NULL`,
    [slotId]
  )
  throw new ConflictError(slot?.["status"] === "open" ? "booking.slot_full" : "booking.slot_closed")
}

/** Gives held places back, slot by slot in id order. */
export async function giveBackHeld(manager: Executor, list: SlotUnits[]): Promise<void> {
  for (const { slotId, units } of list) {
    await manager.execute(
      `UPDATE booking_slot SET held = held - ?, updated_at = now() WHERE id = ?`,
      [units, slotId]
    )
  }
}

/**
 * Removes holds already locked by the caller's delete: their slot rows go
 * and each slot's `held` falls by what they kept. How many holds.
 */
async function dropDeletedHolds(manager: Executor, holdIds: string[]): Promise<number> {
  if (holdIds.length === 0) {
    return 0
  }
  const units = await rows(
    manager,
    `DELETE FROM booking_hold_slot WHERE hold_id IN (${marks(holdIds.length)})
     RETURNING slot_id, units`,
    holdIds
  )
  await giveBackHeld(manager, unitsBySlot(units))
  return holdIds.length
}

/** Releases holds by id, expired or not; how many there were. */
export async function releaseHolds(manager: Executor, holdIds: string[]): Promise<number> {
  if (holdIds.length === 0) {
    return 0
  }
  const sorted = [...holdIds].sort()
  const gone = await rows(
    manager,
    `DELETE FROM booking_hold WHERE id IN (${marks(sorted.length)}) RETURNING id`,
    sorted
  )
  return dropDeletedHolds(
    manager,
    gone.map((row) => String(row["id"]))
  )
}

/**
 * Releases holds past their end (by `now`, the database's clock when
 * null), a batch at a time; only those on `slotIds` when given. A hold
 * another run has locked (its cart is changing it) is skipped, not waited
 * for: the next run takes it if it is still expired. How many.
 */
export async function releaseExpired(
  manager: Executor,
  now: Date | null,
  slotIds: string[] | null
): Promise<number> {
  const onSlots =
    slotIds && slotIds.length > 0
      ? `AND id IN (SELECT hold_id FROM booking_hold_slot WHERE slot_id IN (${marks(slotIds.length)}))`
      : ""
  const gone = await rows(
    manager,
    `DELETE FROM booking_hold WHERE id IN (
       SELECT id FROM booking_hold
        WHERE expires_at <= COALESCE(?::timestamptz, now()) ${onSlots}
        ORDER BY id LIMIT ? FOR UPDATE SKIP LOCKED)
     RETURNING id`,
    [now, ...(slotIds && slotIds.length > 0 ? slotIds : []), SWEEP_BATCH]
  )
  return dropDeletedHolds(
    manager,
    gone.map((row) => String(row["id"]))
  )
}
