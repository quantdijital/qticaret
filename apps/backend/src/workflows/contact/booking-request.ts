import { emitEventStep } from "@medusajs/medusa/core-flows"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../lib/errors"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import type { BookingRequestDetails, ReceiveInput } from "../../modules/contact-messages/service"
import type { BookableRow } from "../booking/product"
import { CONTACT_MESSAGE_RECEIVED, receiveContactMessageStep } from "./messages"

type Container = Pick<MedusaContainer, "resolve">

export interface BookingRequestInput {
  product_id: string
  sales_channel_ids: readonly string[]
  customer_id: string | null
  name: string
  phone: string
  email: string
  slot_id?: string | undefined
  date?: string | undefined
  month?: string | undefined
  adults: number
  children?: number | undefined
  note: string
}

interface ProductRow {
  id: string
  status?: string | null
  sales_channels?: ({ id: string } | null)[] | null
  product_extension?: { booking_mode?: string | null } | null
  bookable?: BookableRow | null
}

/** Today in the shop's zone, YYYY-MM-DD. */
const todayIn = (timezone: string, now: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)

/**
 * The product takes requests: published in the storefront's channel,
 * dated, sold by request or both (else `booking.request_not_offered`).
 */
async function requestedProduct(container: Container, input: BookingRequestInput) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "status", "sales_channels.id", "product_extension.booking_mode", "bookable.*"],
    filters: { id: input.product_id },
  })
  const product = data[0] as ProductRow | undefined
  const listed = (product?.sales_channels ?? []).some((channel) =>
    input.sales_channel_ids.includes(channel?.id ?? "")
  )
  if (product?.status !== "published" || !listed) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.product_unknown")
  }
  const bookable = product.bookable
  if (
    product.product_extension?.booking_mode !== "departure" ||
    !bookable ||
    (bookable.sale_mode !== "request" && bookable.sale_mode !== "both")
  ) {
    throw new ValidationError("booking.request_not_offered", { field: "product_id" })
  }
  return bookable
}

/** A departure asked for: the product's own, on sale (not closed or cancelled), not started. */
async function checkSlot(container: Container, bookable: BookableRow, slotId: string, now: Date) {
  const [slot] = await container
    .resolve<BookingModuleService>(BOOKING_MODULE)
    .listBookingSlots({ id: slotId }, { take: 1 })
  if (
    slot?.bookable_id !== bookable.id ||
    slot.status !== "open" ||
    new Date(slot.starts_at).getTime() <= now.getTime()
  ) {
    throw new ValidationError("booking.request_slot_invalid", { field: "slot_id" })
  }
}

/**
 * Checks a call-me request against its product (adr/0076 Ek 2026-11-23)
 * and words it as a contact message of subject `booking`. Writes nothing:
 * no places taken, no cart.
 */
export const checkBookingRequestStep = createStep(
  "booking-request-check",
  async (input: BookingRequestInput, { container }) => {
    const now = new Date()
    const bookable = await requestedProduct(container, input)
    const people = input.adults + (input.children ?? 0)
    if (people > bookable.max_units_per_cart) {
      throw new ValidationError("booking.request_people_invalid", {
        field: "adults",
        values: { max: String(bookable.max_units_per_cart) },
      })
    }
    const today = todayIn(bookable.timezone, now)
    if (input.slot_id) {
      await checkSlot(container, bookable, input.slot_id, now)
    }
    // Not in the past, and at most two years ahead: no request for a far-off day
    const horizon = `${String(Number(today.slice(0, 4)) + 2)}${today.slice(4)}`
    if (
      (input.date && (input.date < today || input.date > horizon)) ||
      (input.month && (input.month < today.slice(0, 7) || input.month > horizon.slice(0, 7)))
    ) {
      throw new ValidationError("booking.request_when_invalid", {
        field: input.date ? "date" : "month",
      })
    }
    const details: BookingRequestDetails = {
      ...(input.slot_id ? { slot_id: input.slot_id } : {}),
      ...(input.date ? { date: input.date } : {}),
      ...(input.month ? { month: input.month } : {}),
      adults: input.adults,
      ...(input.children ? { children: input.children } : {}),
    }
    const message: ReceiveInput = {
      subject: "booking",
      order_number: null,
      customer_id: input.customer_id,
      name: input.name,
      email: input.email,
      phone: input.phone,
      body: input.note,
      product_id: input.product_id,
      details,
    }
    return new StepResponse(message)
  }
)

/**
 * A dated product's call-me request (adr/0076 Ek 2026-11-23): checked,
 * kept sealed as a contact message, the shop alerted as for any message.
 */
export const receiveBookingRequestWorkflow = createWorkflow(
  "booking-request-receive",
  (input: BookingRequestInput) => {
    const message = checkBookingRequestStep(input)
    const created = receiveContactMessageStep(message)
    emitEventStep({
      eventName: CONTACT_MESSAGE_RECEIVED,
      data: transform({ created }, ({ created }) => ({ id: created.id })),
    })
    return new WorkflowResponse(created)
  }
)
