import { TRAVELER_KEEP_DAYS, asks, levelOf } from "../../lib/booking/travelers"
import type { TravelerLevel } from "../../lib/booking/travelers"
import { asInt, rows } from "./sql"
import type { Executor } from "./sql"

/**
 * A booking's travelers (adr/0076 §7): what of a cart's travelers the
 * order's booking keeps, and their deletion date following their
 * departure's. KVKK: no more than the booking needs is kept.
 */

/** A departure the booking took: its places and the level its product asks now. */
interface BookedDeparture {
  slot_id: string
  units: number
  level: TravelerLevel
}

async function bookedDepartures(manager: Executor, bookingId: string): Promise<BookedDeparture[]> {
  const found = await rows(
    manager,
    `SELECT u.slot_id, u.units, b.traveler_fields
       FROM booking_slot_use u
       JOIN booking_slot s ON s.id = u.slot_id
       JOIN bookable b ON b.id = s.bookable_id
      WHERE u.booking_id = ? AND u.deleted_at IS NULL
      ORDER BY u.slot_id`,
    [bookingId]
  )
  return found.map((row) => ({
    slot_id: String(row["slot_id"]),
    units: asInt(row["units"]),
    level: levelOf(row["traveler_fields"]),
  }))
}

/** A column kept when the level asks for it, emptied otherwise. */
const keptIf = (asked: boolean, column: string) => `${column} = ${asked ? column : "NULL"}`

/**
 * The cart's travelers made the booking's (the order's confirmation), in
 * the confirmation's transaction; again changes nothing. Only what the
 * booking took is kept: a traveler on a departure the booking did not
 * take (left in the cart after its line was removed), past its places or
 * on a departure that asks nothing now is deleted for good; a field its
 * product no longer asks (the level lowered after they were entered) is
 * emptied. How many were attached.
 */
export async function attachTravelers(
  manager: Executor,
  cartId: string,
  bookingId: string
): Promise<number> {
  const departures = (await bookedDepartures(manager, bookingId)).filter(
    (departure) => departure.level !== "none" && departure.units > 0
  )
  const within = departures.map(() => "(slot_id = ? AND position < ?)").join(" OR ")
  await manager.execute(
    `DELETE FROM booking_traveler
      WHERE cart_id = ? AND booking_id IS NULL AND NOT (${within || "false"})`,
    [cartId, ...departures.flatMap((departure) => [departure.slot_id, departure.units])]
  )
  let attached = 0
  for (const departure of departures) {
    const document = asks(departure.level, "document_no")
    const updated = await rows(
      manager,
      `UPDATE booking_traveler
          SET booking_id = ?, updated_at = now(),
              ${keptIf(asks(departure.level, "birth_date"), "birth_date")},
              ${keptIf(asks(departure.level, "nationality"), "nationality")},
              ${keptIf(document, "document_encrypted")},
              ${keptIf(document, "document_hash")},
              ${keptIf(document, "document_last4")},
              ${keptIf(document, "key_version")}
        WHERE cart_id = ? AND slot_id = ? AND booking_id IS NULL AND deleted_at IS NULL
        RETURNING id`,
      [bookingId, cartId, departure.slot_id]
    )
    attached += updated.length
  }
  return attached
}

const KEEP_SECONDS = TRAVELER_KEEP_DAYS * 24 * 60 * 60

/**
 * A departure's travelers' deletion date moved with it (`purgeAfterOf`:
 * its end, or start, plus the period kept) when staff change its dates.
 */
export async function refreshTravelerPurge(manager: Executor, slotId: string): Promise<void> {
  await manager.execute(
    `UPDATE booking_traveler t
        SET purge_after = COALESCE(s.ends_at, s.starts_at) + make_interval(secs => ?),
            updated_at = now()
       FROM booking_slot s
      WHERE s.id = ? AND t.slot_id = s.id`,
    [KEEP_SECONDS, slotId]
  )
}
