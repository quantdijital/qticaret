import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { adjustmentsInKurus } from "../../../lib/booking/settings"
import { ValidationError } from "../../../lib/errors"
import { BOOKING_MODULE } from "../../../modules/booking"
import type BookingModuleService from "../../../modules/booking/service"
import type { SlotChanges } from "../../../modules/booking/service"
import { checkVariants, datedProduct } from "../product"

type SlotStatus = "open" | "closed" | "cancelled"

/** A departure as staff enter it; price differences in lira. */
export interface NewSlot {
  starts_at: Date
  ends_at?: Date | null | undefined
  capacity: number
  status?: SlotStatus | undefined
  price_adjustments?: Record<string, number> | null | undefined
}

/** A departure's own fields to change; price differences in lira. */
export interface SlotUpdate {
  capacity?: number | undefined
  status?: SlotStatus | undefined
  starts_at?: Date | undefined
  ends_at?: Date | null | undefined
  price_adjustments?: Record<string, number> | null | undefined
}

function checkDates(startsAt: Date, endsAt: Date | null | undefined): void {
  if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw new ValidationError("booking.slot_dates_invalid", { field: "ends_at" })
  }
}

/** New departures of a bookable, places all free; undone by deleting them. */
export const createSlotsStep = createStep(
  "booking-create-slots",
  async (
    input: { bookable: { id: string; variantIds: string[] }; slots: NewSlot[] },
    { container }
  ) => {
    const known = new Set(input.bookable.variantIds)
    for (const slot of input.slots) {
      checkDates(slot.starts_at, slot.ends_at)
      if (Object.keys(slot.price_adjustments ?? {}).some((id) => !known.has(id))) {
        throw new ValidationError("booking.variant_unknown", { field: "price_adjustments" })
      }
    }
    const service = container.resolve<BookingModuleService>(BOOKING_MODULE)
    // Counters are never taken from the request: every slot starts empty
    const made = await service.createBookingSlots(
      input.slots.map((slot) => ({
        bookable_id: input.bookable.id,
        starts_at: slot.starts_at,
        ends_at: slot.ends_at ?? null,
        capacity: slot.capacity,
        status: slot.status ?? "open",
        price_adjustments: adjustmentsInKurus(slot.price_adjustments ?? null),
      }))
    )
    const ids = made.map((slot) => slot.id)
    return new StepResponse(ids, ids)
  },
  async (ids, { container }) => {
    if (ids && ids.length > 0) {
      await container.resolve<BookingModuleService>(BOOKING_MODULE).deleteBookingSlots(ids)
    }
  }
)

interface SlotRow {
  id: string
  bookable_id: string
  capacity: number
  status: SlotStatus
  starts_at: Date
  ends_at: Date | null
  price_adjustments: Record<string, number> | null
}

async function productOfSlot(container: MedusaContainer, slot: SlotRow) {
  const service = container.resolve<BookingModuleService>(BOOKING_MODULE)
  const bookable = await service.retrieveBookable(slot.bookable_id, { select: ["product_id"] })
  return datedProduct(container, bookable.product_id)
}

/**
 * A departure's own fields changed in one statement, its counters kept;
 * a capacity below the places sold and held is refused (the module
 * checks it against the row). Undone by writing back what it had.
 */
export const updateSlotStep = createStep(
  "booking-update-slot",
  async (input: { id: string; changes: SlotUpdate }, { container }) => {
    const service = container.resolve<BookingModuleService>(BOOKING_MODULE)
    const [slot] = (await service.listBookingSlots(
      { id: input.id },
      { take: 1 }
    )) as unknown as SlotRow[]
    if (!slot) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "booking.slot_unknown")
    }
    const { changes } = input
    checkDates(
      changes.starts_at ?? slot.starts_at,
      changes.ends_at === undefined ? slot.ends_at : changes.ends_at
    )
    if (changes.price_adjustments) {
      checkVariants(
        await productOfSlot(container, slot),
        Object.keys(changes.price_adjustments),
        "price_adjustments"
      )
    }
    const write: SlotChanges = {
      capacity: changes.capacity,
      status: changes.status,
      starts_at: changes.starts_at,
      ends_at: changes.ends_at,
      ...(changes.price_adjustments === undefined
        ? {}
        : { price_adjustments: adjustmentsInKurus(changes.price_adjustments) }),
    }
    await service.updateSlot(slot.id, write)
    const previous: SlotChanges = {
      ...(changes.capacity === undefined ? {} : { capacity: slot.capacity }),
      ...(changes.status === undefined ? {} : { status: slot.status }),
      ...(changes.starts_at === undefined ? {} : { starts_at: slot.starts_at }),
      ...(changes.ends_at === undefined ? {} : { ends_at: slot.ends_at }),
      ...(changes.price_adjustments === undefined
        ? {}
        : { price_adjustments: slot.price_adjustments }),
    }
    return new StepResponse(slot.id, { id: slot.id, previous })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = container.resolve<BookingModuleService>(BOOKING_MODULE)
    // A capacity places were sold against since stays: the counters must fit it
    await service.updateSlot(undo.id, undo.previous).catch(async () => {
      await service.updateSlot(undo.id, { ...undo.previous, capacity: undefined })
    })
  }
)
