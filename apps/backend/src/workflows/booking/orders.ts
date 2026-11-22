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

type Container = Pick<MedusaContainer, "resolve">

interface OrderLine {
  id: string
  quantity: unknown
  metadata?: unknown
}

const service = (container: Container) => container.resolve<BookingModuleService>(BOOKING_MODULE)

/** The order's dated lines, in line order. */
async function datedLinesOf(container: Container, orderId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "items.id", "items.quantity", "items.metadata"],
    filters: { id: orderId },
  })
  const items = ((data[0] as { items?: (OrderLine | null)[] } | undefined)?.items ?? []).flatMap(
    (item) => (item ? [item] : [])
  )
  return items.flatMap((line) => {
    const mark = bookingMarkOf(line.metadata)
    return mark ? [{ line, mark }] : []
  })
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

export type ConfirmOutcome = "none" | "existing" | "confirmed" | "retaken" | "failed"

/**
 * A placed order's places moved from its cart's hold to `sold` and its
 * booking written (adr/0076 §5): `confirmHold`, idempotent (the order's
 * booking found, nothing changes). The hold is checked live and pushed at
 * the completion, so it is there; if it is not (swept in between), the
 * places are taken again under the order's own key and confirmed. Places
 * that are no longer free are never invented: the order stands, the
 * failure is logged as an error (the error tracker's alarm) for staff.
 */
export async function confirmOrderBookings(
  container: Container,
  orderId: string
): Promise<ConfirmOutcome> {
  const lines = await datedLinesOf(container, orderId)
  if (lines.length === 0) {
    return "none"
  }
  const bookings = service(container)
  if ((await bookings.listBookings({ order_id: orderId }, { take: 1 })).length > 0) {
    return "existing"
  }
  const lineId = lines[0]?.line.id ?? null
  const holdId = lines[0]?.mark.hold_id ?? ""
  try {
    await bookings.confirmHold(holdId, orderId, lineId)
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
    await bookings.confirmHold(hold.hold_id, orderId, lineId)
    logger.warn({ event: "booking.confirm_retaken", order_id: orderId })
    return "retaken"
  } catch (error) {
    logger.error({ event: "booking.confirm_failed", order_id: orderId, err: errorSummary(error) })
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
  async (input: { order_id: string }, { container }) =>
    new StepResponse(await confirmOrderBookings(container, input.order_id))
)

/** `confirmOrderBookings` under the order's lock: two deliveries of the event write one booking. */
export const confirmOrderBookingsWorkflow = createWorkflow(
  "booking-confirm-order",
  (input: { order_id: string }) => {
    const key = transform({ input }, ({ input }) => `booking:order:${input.order_id}`)
    acquireLockStep({ key, timeout: 10, ttl: 30 })
    const outcome = confirmOrderBookingsStep(input)
    releaseLockStep({ key })
    return new WorkflowResponse(outcome)
  }
)
