import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { slotsById, slotsOfBookable } from "./availability"
import type { SlotAvailability } from "./availability"
import { cancelBooking, confirmHold, extendHold, holdUnits, updateSlot } from "./counters"
import type { HoldState, SlotChanges } from "./counters"
import { releaseExpired, releaseHolds } from "./sql"
import type { Executor, SlotUnits } from "./sql"
import { Bookable } from "./models/bookable"
import { Booking, BookingSlotUse } from "./models/booking"
import { BookingHold, BookingHoldSlot } from "./models/booking-hold"
import { BookingSlot } from "./models/booking-slot"

export type { SlotAvailability } from "./availability"
export type { HoldState, SlotChanges } from "./counters"
export type { SlotUnits } from "./sql"

const managerOf = (sharedContext: Context): Executor => {
  const manager = (sharedContext.transactionManager ?? sharedContext.manager) as
    Executor | undefined
  if (!manager) {
    throw new Error("booking: no database manager in the context")
  }
  return manager
}

/**
 * Dated products' bookings (adr/0076 §3). The generated CRUD writes
 * settings, new slots and reads; every change to a slot's counters goes
 * through the methods below, raw SQL with every value bound, each call one
 * transaction (`sql.ts`, `counters.ts`). A slot is never updated through
 * the generated `updateBookingSlots`: it would write counters it read.
 */
class BookingModuleService extends MedusaService({
  Bookable,
  BookingSlot,
  BookingHold,
  BookingHoldSlot,
  Booking,
  BookingSlotUse,
}) {
  /** Sets a cart's places per slot (0 gives one back); null: the cart holds nothing now. */
  @InjectTransactionManager()
  async holdUnits(
    cartId: string,
    items: SlotUnits[],
    ttlMinutes: number,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<HoldState | null> {
    return holdUnits(managerOf(sharedContext), cartId, items, ttlMinutes)
  }

  /** Lets a hold go, its places freed; whether there was one. */
  @InjectTransactionManager()
  async releaseHold(holdId: string, @MedusaContext() sharedContext: Context = {}) {
    return (await releaseHolds(managerOf(sharedContext), [holdId])) > 0
  }

  /** A live hold's end pushed to at least `minutes` from now; null when it has none or it ended. */
  @InjectTransactionManager()
  async extendHold(
    cartId: string,
    minutes: number,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<HoldState | null> {
    return extendHold(managerOf(sharedContext), cartId, minutes)
  }

  /** A hold made an order's booking; the same call again changes nothing. */
  @InjectTransactionManager()
  async confirmHold(
    holdId: string,
    orderId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ booking_id: string; created: boolean }> {
    return confirmHold(managerOf(sharedContext), holdId, orderId)
  }

  /** A confirmed booking cancelled and its places given back; whether it changed. */
  @InjectTransactionManager()
  async cancelBooking(
    bookingId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    return cancelBooking(managerOf(sharedContext), bookingId)
  }

  /** Holds past their end released, a batch a call (`now`: the database's clock by default). */
  @InjectTransactionManager()
  async releaseExpiredHolds(
    now: Date | null = null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<number> {
    return releaseExpired(managerOf(sharedContext), now, null)
  }

  /** A slot's own fields changed, its counters kept; whether it exists. */
  @InjectTransactionManager()
  async updateSlot(
    slotId: string,
    changes: SlotChanges,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    return updateSlot(managerOf(sharedContext), slotId, changes)
  }

  /** The slots named with what is free now (live holds only). */
  @InjectManager()
  async slotAvailability(
    slotIds: string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<SlotAvailability[]> {
    return slotsById(managerOf(sharedContext), slotIds)
  }

  /** A bookable's slots by start with what is free now. */
  @InjectManager()
  async bookableSlots(
    bookableId: string,
    options: { from?: Date | undefined; limit: number },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<SlotAvailability[]> {
    return slotsOfBookable(managerOf(sharedContext), bookableId, options)
  }
}

export default BookingModuleService
