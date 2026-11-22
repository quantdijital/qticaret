import { asInt, marks, rows } from "./sql"
import type { Executor, Row } from "./sql"

/** A slot with the places still free for a new hold. */
export interface SlotAvailability {
  id: string
  bookable_id: string
  starts_at: Date
  ends_at: Date | null
  status: "open" | "closed" | "cancelled"
  capacity: number
  sold: number
  /** Places live holds keep (expired ones left out, swept or not). */
  held: number
  /** `capacity - sold - held`, never below zero. */
  available: number
  price_adjustments: Record<string, number> | null
}

// Live holds' places per slot: an expired hold the sweep has not reached
// yet blocks nothing (adr/0076 §5)
const SELECT = `
  SELECT s.id, s.bookable_id, s.starts_at, s.ends_at, s.status, s.capacity, s.sold,
         s.price_adjustments, COALESCE(h.units, 0)::int AS held_live
    FROM booking_slot s
    LEFT JOIN (
      SELECT hs.slot_id, SUM(hs.units) AS units
        FROM booking_hold_slot hs
        JOIN booking_hold bh ON bh.id = hs.hold_id AND bh.deleted_at IS NULL
       WHERE hs.deleted_at IS NULL AND bh.expires_at > now()
       GROUP BY hs.slot_id
    ) h ON h.slot_id = s.id
   WHERE s.deleted_at IS NULL`

const toDate = (value: unknown): Date => new Date(value as string | Date)

/** A row with `held_live` read as a slot with what is free. */
export function availabilityOf(row: Row): SlotAvailability {
  const capacity = asInt(row["capacity"])
  const sold = asInt(row["sold"])
  const held = asInt(row["held_live"])
  const adjustments = row["price_adjustments"]
  return {
    id: String(row["id"]),
    bookable_id: String(row["bookable_id"]),
    starts_at: toDate(row["starts_at"]),
    ends_at: row["ends_at"] ? toDate(row["ends_at"]) : null,
    status: row["status"] as SlotAvailability["status"],
    capacity,
    sold,
    held,
    available: Math.max(0, capacity - sold - held),
    price_adjustments:
      typeof adjustments === "string"
        ? (JSON.parse(adjustments) as Record<string, number>)
        : ((adjustments as Record<string, number> | null) ?? null),
  }
}

/** The slots named, with what is free; unknown ids are left out. */
export async function slotsById(manager: Executor, ids: string[]): Promise<SlotAvailability[]> {
  if (ids.length === 0) {
    return []
  }
  const found = await rows(manager, `${SELECT} AND s.id IN (${marks(ids.length)})`, ids)
  return found.map(availabilityOf)
}

/**
 * Several bookables' open slots with a place free now, starting after
 * `from`, at most `limit` each, by bookable and start: a page of cards in
 * one statement (adr/0076 §10). The sales' close is the caller's to apply.
 */
export async function openSlotsOf(
  manager: Executor,
  bookableIds: readonly string[],
  options: { from: Date; limit: number }
): Promise<SlotAvailability[]> {
  if (bookableIds.length === 0) {
    return []
  }
  const found = await rows(
    manager,
    `SELECT * FROM (
       SELECT x.*, ROW_NUMBER() OVER (PARTITION BY x.bookable_id ORDER BY x.starts_at, x.id) AS place
         FROM (${SELECT} AND s.bookable_id IN (${marks(bookableIds.length)})
                 AND s.status = 'open' AND s.starts_at > ?) x
        WHERE x.capacity - x.sold - x.held_live > 0
     ) y
     WHERE y.place <= ?
     ORDER BY y.bookable_id, y.starts_at, y.id`,
    [...bookableIds, options.from, options.limit]
  )
  return found.map(availabilityOf)
}

/** A bookable's slots by start, from `from` on when given, at most `limit`. */
export async function slotsOfBookable(
  manager: Executor,
  bookableId: string,
  options: { from?: Date | undefined; limit: number }
): Promise<SlotAvailability[]> {
  const found = await rows(
    manager,
    `${SELECT} AND s.bookable_id = ? ${options.from ? "AND s.starts_at >= ?" : ""}
     ORDER BY s.starts_at, s.id LIMIT ?`,
    [bookableId, ...(options.from ? [options.from] : []), options.limit]
  )
  return found.map(availabilityOf)
}
