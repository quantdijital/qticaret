import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils"
import { slotsById, slotsOfBookable } from "./availability"
import type { SlotAvailability } from "./availability"
import { cartHold } from "./cart-hold"
import type { HoldClient } from "./client-share"
import { cancelBooking, confirmHold, extendHold, holdUnits, updateSlot } from "./counters"
import type { HoldState, SlotChanges } from "./counters"
import { createSlots, deleteEmptySlots } from "./slots"
import type { SlotInput } from "./slots"
import { releaseExpired, releaseHolds } from "./sql"
import type { Executor, SlotUnits } from "./sql"
import { Bookable } from "./models/bookable"
import { parseKey } from "@qticaret/server-kit"
import type { CleanTraveler } from "../../lib/booking/travelers"
import { Booking, BookingSlotUse } from "./models/booking"
import { BookingHold, BookingHoldSlot } from "./models/booking-hold"
import { BookingSlot } from "./models/booking-slot"
import { BookingTraveler } from "./models/booking-traveler"
import { attachTravelers, replaceCartTravelers, revealDocument, sealTraveler } from "./travelers"
import type { TravelerKeys } from "./travelers"

/** The shop's PII keys (adr/0009), for travelers' ID numbers; hex, 32 bytes each. */
export interface BookingModuleOptions {
  encryptionKey?: string
  hashKey?: string
}

export type { SlotAvailability } from "./availability"
export type { CartHold } from "./cart-hold"
export type { HoldClient } from "./client-share"
export type { HoldState, SlotChanges } from "./counters"
export type { SlotInput } from "./slots"
export type { SlotUnits } from "./sql"

const managerOf = (sharedContext: Context): Executor => {
  const manager = (sharedContext.transactionManager ?? sharedContext.manager) as
    Executor | undefined
  if (!manager) {
    throw new Error("booking: no database manager in the context")
  }
  return manager
}

// No parameters: a call with the generated writer's arguments does not
// compile, and one that gets past the types still throws
function refuseCounterWrite(): never {
  throw new MedusaError(
    MedusaError.Types.NOT_ALLOWED,
    "booking counters are written only through the booking service's own methods"
  )
}

/**
 * Dated products' bookings (adr/0076 §3). The generated CRUD writes
 * settings (bookables) and reads; slots, holds and bookings are written
 * only through the methods below, raw SQL with every value bound, each
 * call one transaction (`sql.ts`, `holds.ts`, `counters.ts`, `slots.ts`).
 */
class BookingModuleService extends MedusaService({
  Bookable,
  BookingSlot,
  BookingHold,
  BookingHoldSlot,
  Booking,
  BookingSlotUse,
  BookingTraveler,
}) {
  private readonly options: BookingModuleOptions
  private keys: TravelerKeys | undefined

  constructor(container: Record<string, unknown>, options: BookingModuleOptions = {}) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    this.options = options
  }

  // Read on first use: a test of the counters runs without them
  private travelerKeys(): TravelerKeys {
    this.keys ??= {
      encryption: parseKey(this.options.encryptionKey ?? "", "booking encryptionKey"),
      hash: parseKey(this.options.hashKey ?? "", "booking hashKey"),
    }
    return this.keys
  }

  /**
   * The cart's travelers not yet booked replaced by these, each number
   * sealed here (the plain number goes no further); `purgeAfter` per
   * departure. Checked before (`lib/booking/travelers`).
   */
  @InjectTransactionManager()
  async setCartTravelers(
    cartId: string,
    travelers: readonly CleanTraveler[],
    purgeAfter: Record<string, Date>,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<number> {
    const keys = this.travelerKeys()
    return replaceCartTravelers(
      managerOf(sharedContext),
      cartId,
      travelers.map((traveler) => {
        const purge = purgeAfter[traveler.slot_id]
        if (!purge) {
          throw new Error("booking: no purge date for a traveler's departure")
        }
        return sealTraveler(keys, cartId, traveler, purge)
      })
    )
  }

  /** The cart's travelers made the booking's; again changes nothing. */
  @InjectTransactionManager()
  async attachTravelers(
    cartId: string,
    bookingId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<number> {
    return attachTravelers(managerOf(sharedContext), cartId, bookingId)
  }

  /**
   * A booked traveler's full ID or passport number (null: none asked).
   * For the audited staff route only; never logged, never sent on.
   */
  @InjectManager()
  async revealTravelerDocument(
    travelerId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string | null> {
    return revealDocument(managerOf(sharedContext), this.travelerKeys(), travelerId)
  }

  /** Sets a cart's places per slot (0 gives one back); null: the cart holds nothing now. */
  @InjectTransactionManager()
  async holdUnits(
    cartId: string,
    items: SlotUnits[],
    ttlMinutes: number,
    client: HoldClient | null = null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<HoldState | null> {
    return holdUnits(managerOf(sharedContext), cartId, items, ttlMinutes, client)
  }

  /** Lets a hold go, its places freed; whether there was one. */
  @InjectTransactionManager()
  async releaseHold(holdId: string, @MedusaContext() sharedContext: Context = {}) {
    return (await releaseHolds(managerOf(sharedContext), [holdId])) > 0
  }

  /**
   * A live hold's end pushed to at least `minutes` from now; null when it
   * has none or it ended. `completion`: the order's completion, which may
   * go past the hold's lifetime by its grace.
   */
  @InjectTransactionManager()
  async extendHold(
    cartId: string,
    minutes: number,
    options: { completion?: boolean } = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<HoldState | null> {
    return extendHold(managerOf(sharedContext), cartId, minutes, options)
  }

  /** A hold made an order's booking; the same call again changes nothing. */
  @InjectTransactionManager()
  async confirmHold(
    holdId: string,
    orderId: string,
    lineItemId: string | null = null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ booking_id: string; created: boolean }> {
    return confirmHold(managerOf(sharedContext), holdId, orderId, lineItemId)
  }

  /** The cart's hold with its places per slot (live or not), or null. */
  @InjectManager()
  async cartHold(cartId: string, @MedusaContext() sharedContext: Context = {}) {
    return cartHold(managerOf(sharedContext), cartId)
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
    return releaseExpired(managerOf(sharedContext), now)
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

  /** New slots, every one empty (`sold`, `held` 0); their ids in the order given. */
  @InjectTransactionManager()
  async createSlots(
    slots: SlotInput[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string[]> {
    return createSlots(managerOf(sharedContext), slots)
  }

  /** Slots removed only while nothing is sold or held on them (a new slot undone); the ids gone. */
  @InjectTransactionManager()
  async deleteEmptySlots(
    ids: string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string[]> {
    return deleteEmptySlots(managerOf(sharedContext), ids)
  }

  // The counters' rows are written only by the methods above: a generated
  // writer could set `sold`/`held`, drop a hold without giving its places
  // back or bring one back. Field initialisers run after the base
  // constructor, so these replace the generated methods on every instance.
  override createBookingSlots = refuseCounterWrite
  override updateBookingSlots = refuseCounterWrite
  override deleteBookingSlots = refuseCounterWrite
  override softDeleteBookingSlots = refuseCounterWrite
  override restoreBookingSlots = refuseCounterWrite
  override createBookingHolds = refuseCounterWrite
  override updateBookingHolds = refuseCounterWrite
  override deleteBookingHolds = refuseCounterWrite
  override softDeleteBookingHolds = refuseCounterWrite
  override restoreBookingHolds = refuseCounterWrite
  override createBookingHoldSlots = refuseCounterWrite
  override updateBookingHoldSlots = refuseCounterWrite
  override deleteBookingHoldSlots = refuseCounterWrite
  override softDeleteBookingHoldSlots = refuseCounterWrite
  override restoreBookingHoldSlots = refuseCounterWrite
  override createBookings = refuseCounterWrite
  override updateBookings = refuseCounterWrite
  override deleteBookings = refuseCounterWrite
  override softDeleteBookings = refuseCounterWrite
  override restoreBookings = refuseCounterWrite
  override createBookingSlotUses = refuseCounterWrite
  override updateBookingSlotUses = refuseCounterWrite
  override deleteBookingSlotUses = refuseCounterWrite
  override softDeleteBookingSlotUses = refuseCounterWrite
  override restoreBookingSlotUses = refuseCounterWrite
  // A traveler is written only sealed (`setCartTravelers`); deleted for good, never soft
  override createBookingTravelers = refuseCounterWrite
  override updateBookingTravelers = refuseCounterWrite
  override softDeleteBookingTravelers = refuseCounterWrite
  override restoreBookingTravelers = refuseCounterWrite
}

/** The generated writers this service replaces, for the test that calls each. */
export const REFUSED_WRITERS = [
  "BookingSlots",
  "BookingHolds",
  "BookingHoldSlots",
  "Bookings",
  "BookingSlotUses",
]
  .flatMap((name) =>
    ["create", "update", "delete", "softDelete", "restore"].map((verb) => `${verb}${name}`)
  )
  .concat(["create", "update", "softDelete", "restore"].map((verb) => `${verb}BookingTravelers`))

export default BookingModuleService
