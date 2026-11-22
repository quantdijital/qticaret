import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import type { BookableSettingsType } from "../../lib/booking/settings"
import { ensureBookableStep, setBookableStep } from "./steps/bookable"
import { createSlotsStep, updateSlotStep } from "./steps/slots"
import type { NewSlot, SlotUpdate } from "./steps/slots"

/**
 * Staff's side of dated products (adr/0076 §3, §9): the settings, new
 * departures, a departure changed. Each under the product's (or the
 * slot's) lock; every step undoes itself. The places themselves change
 * only through the module's counter methods.
 */

const productLock = (productId: string) => `booking:product:${productId}`

/** A dated product's booking settings, made on the first save. */
export const setBookableWorkflow = createWorkflow(
  "booking-set-bookable",
  (input: { product_id: string; settings: BookableSettingsType }) => {
    const lockKey = transform({ input }, ({ input }) => productLock(input.product_id))
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 30 })
    const id = setBookableStep(input)
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(id)
  }
)

/** New departures of a dated product; its settings made with the defaults if it has none. */
export const createBookingSlotsWorkflow = createWorkflow(
  "booking-create-slots",
  (input: { product_id: string; slots: NewSlot[] }) => {
    const lockKey = transform({ input }, ({ input }) => productLock(input.product_id))
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 30 })
    const bookable = ensureBookableStep({ product_id: input.product_id })
    const ids = createSlotsStep(
      transform({ input, bookable }, ({ input, bookable }) => ({ bookable, slots: input.slots }))
    )
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(ids)
  }
)

/** A departure's capacity, state, dates or price differences changed. */
export const updateBookingSlotWorkflow = createWorkflow(
  "booking-update-slot",
  (input: { id: string; changes: SlotUpdate }) => {
    const lockKey = transform({ input }, ({ input }) => `booking:slot:${input.id}`)
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 30 })
    const id = updateSlotStep(input)
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(id)
  }
)
