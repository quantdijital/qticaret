import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { bookingMarkOf } from "../../lib/booking/cart-lines"
import type { BookingMark } from "../../lib/booking/cart-lines"
import { errorSummary, logger } from "../../lib/logging"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import type { SlotUnits } from "../../modules/booking/service"
import { alertConfirmFailed } from "./confirm-alert"

type Container = Pick<MedusaContainer, "resolve">

interface OrderLine {
  id: string
  quantity: unknown
  metadata?: unknown
}

const service = (container: Container) => container.resolve<BookingModuleService>(BOOKING_MODULE)

/** The order's dated lines, in line order, and whether it was cancelled. */
async function datedLinesOf(container: Container, orderId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "status", "items.id", "items.quantity", "items.metadata"],
    filters: { id: orderId },
  })
  const order = data[0] as { status?: string | null; items?: (OrderLine | null)[] } | undefined
  const items = (order?.items ?? []).flatMap((item) => (item ? [item] : []))
  const lines = items.flatMap((line) => {
    const mark = bookingMarkOf(line.metadata)
    return mark ? [{ line, mark }] : []
  })
  return { lines, canceled: order?.status === "canceled" }
}

/** Places per slot the order's lines take, as their marks recorded them. */
function unitsOfMarks(lines: { line: OrderLine; mark: BookingMark }[]): SlotUnits[] {
  const totals = new Map<string, number>()
  for (const { line, mark } of lines) {
    totals.set(mark.slot_id, (totals.get(mark.slot_id) ?? 0) + Number(line.quantity) * mark.pax)
  }
  return [...totals.entries()]
    .filter(([, units]) => units > 0)
    .map(([slotId, units]) => ({ slotId, units }))
}

/** The order's cart's travelers made its booking's (adr/0076 §7); again changes nothing. */
export async function moveOrderTravelers(
  container: Container,
  orderId: string,
  bookingId: string
): Promise<number> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["cart.id"],
    filters: { id: orderId },
  })
  const cartId = (data[0] as { cart?: { id: string } | null } | undefined)?.cart?.id
  return cartId ? service(container).attachTravelers(cartId, bookingId) : 0
}

/**
 * `moveOrderTravelers` at the confirmation. A failure does not undo the
 * booking: it is logged (the order's id only) and the travelers stay
 * against the ordered cart, out of the panel's sight; the reconcile job
 * finds them and tries again (`reconcile-travelers.ts`), ringing the
 * panel's bell when it gives up.
 */
export async function attachOrderTravelers(
  container: Container,
  orderId: string,
  bookingId: string
): Promise<void> {
  try {
    await moveOrderTravelers(container, orderId, bookingId)
  } catch (error) {
    logger.error({
      event: "booking.travelers_attach_failed",
      order_id: orderId,
      err: errorSummary(error),
    })
  }
}

export type ConfirmOutcome = "none" | "existing" | "confirmed" | "retaken" | "failed" | "canceled"

export interface ConfirmOptions {
  /** A retry of the reconcile job between its first and last try: no error line for a failure. */
  quiet?: boolean
}

type ConfirmInput = { order_id: string } & ConfirmOptions

/**
 * A placed order's places moved from its cart's hold to `sold` and its
 * booking written (adr/0076 §5): `confirmHold`, idempotent (the order's
 * booking found, nothing changes). The hold is checked live and pushed at
 * the completion, so it is there; if it is not (swept in between), the
 * places are taken again under the order's own key and confirmed. Places
 * that are no longer free are never invented: the order stands, the
 * failure is logged as an error (the error tracker's alarm) and rings
 * the panel's bell for staff. An order cancelled before this ran (its
 * cancel found nothing to cancel) is not confirmed: its hold goes back.
 */
export async function confirmOrderBookings(
  container: Container,
  orderId: string,
  options: ConfirmOptions = {}
): Promise<ConfirmOutcome> {
  const { lines, canceled } = await datedLinesOf(container, orderId)
  if (lines.length === 0) {
    return "none"
  }
  const bookings = service(container)
  const [existing] = await bookings.listBookings({ order_id: orderId }, { take: 1 })
  if (existing) {
    // A run that confirmed but stopped before its travelers: they follow now
    await attachOrderTravelers(container, orderId, existing.id)
    return "existing"
  }
  if (canceled) {
    await bookings.releaseHold(lines[0]?.mark.hold_id ?? "")
    return "canceled"
  }
  const lineId = lines[0]?.line.id ?? null
  const holdId = lines[0]?.mark.hold_id ?? ""
  try {
    const { booking_id: bookingId } = await bookings.confirmHold(holdId, orderId, lineId)
    await attachOrderTravelers(container, orderId, bookingId)
    return "confirmed"
  } catch (error) {
    if ((error as { safeMessage?: unknown }).safeMessage !== "booking.hold_missing") {
      throw error
    }
  }
  try {
    const hold = await bookings.holdUnits(`order:${orderId}`, unitsOfMarks(lines), 10)
    if (!hold) {
      return "none"
    }
    const { booking_id: bookingId } = await bookings.confirmHold(hold.hold_id, orderId, lineId)
    await attachOrderTravelers(container, orderId, bookingId)
    logger.warn({ event: "booking.confirm_retaken", order_id: orderId })
    return "retaken"
  } catch (error) {
    if (!options.quiet) {
      logger.error({ event: "booking.confirm_failed", order_id: orderId, err: errorSummary(error) })
    }
    await alertConfirmFailed(container, orderId)
    return "failed"
  }
}

/** A cancelled order's bookings cancelled, their places given back; again changes nothing. */
export async function cancelOrderBookings(container: Container, orderId: string): Promise<number> {
  const bookings = service(container)
  const confirmed = await bookings.listBookings({ order_id: orderId, status: "confirmed" })
  let cancelled = 0
  for (const booking of confirmed) {
    if (await bookings.cancelBooking(booking.id)) {
      cancelled += 1
    }
  }
  return cancelled
}

export const confirmOrderBookingsStep = createStep(
  "booking-confirm-order",
  async (input: ConfirmInput, { container }) =>
    new StepResponse(
      await confirmOrderBookings(container, input.order_id, { quiet: input.quiet === true })
    )
)

/** `confirmOrderBookings` under the order's lock: two deliveries of the event write one booking. */
export const confirmOrderBookingsWorkflow = createWorkflow(
  "booking-confirm-order",
  (input: ConfirmInput) => {
    const key = transform({ input }, ({ input }) => `booking:order:${input.order_id}`)
    acquireLockStep({ key, timeout: 10, ttl: 30 })
    const outcome = confirmOrderBookingsStep(input)
    releaseLockStep({ key })
    return new WorkflowResponse(outcome)
  }
)

export const cancelOrderBookingsStep = createStep(
  "booking-cancel-order",
  async (input: { order_id: string }, { container }) =>
    new StepResponse(await cancelOrderBookings(container, input.order_id))
)

/**
 * `cancelOrderBookings` under the same lock as the confirmation: a cancel
 * and a placing handled at once never leave the places sold on a
 * cancelled order (the confirmation, running second, finds it cancelled).
 */
export const cancelOrderBookingsWorkflow = createWorkflow(
  "booking-cancel-order",
  (input: { order_id: string }) => {
    const key = transform({ input }, ({ input }) => `booking:order:${input.order_id}`)
    acquireLockStep({ key, timeout: 10, ttl: 30 })
    const cancelled = cancelOrderBookingsStep(input)
    releaseLockStep({ key })
    return new WorkflowResponse(cancelled)
  }
)
