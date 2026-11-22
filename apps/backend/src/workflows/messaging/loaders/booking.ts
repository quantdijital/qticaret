import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { logger } from "../../../lib/logging"
import type {
  BookingCancelVars,
  BookingDepartureVars,
  BookingVars,
} from "../../../lib/messaging/templates"
import { bookingCancelReference } from "../../../lib/orders/locks"
import { BOOKING_MODULE } from "../../../modules/booking"
import type BookingModuleService from "../../../modules/booking/service"
import { ORDER_REFUNDS_MODULE } from "../../../modules/order-refunds"
import type OrderRefundsModuleService from "../../../modules/order-refunds/service"
import { bookingSheet } from "../../booking/sheet"
import type { BookingSheet, SheetDeparture } from "../../booking/sheet"
import { orderUrlOf } from "./order"
import { GREETING, personName } from "./types"
import type { Loaded } from "./types"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A dated order's messages read from its booking (adr/0076 §8, Ek D7b):
 * the confirmation and the reminder from the booking (and one departure),
 * a cancel from the departure's use row. Places are counted; no
 * traveler's name, birth date or document goes in a message.
 */

interface OrderRow {
  id: string
  display_id: number
  email: string | null
  customer_id: string | null
  shipping_address?: { first_name?: string | null } | null
  billing_address?: { first_name?: string | null } | null
}

async function orderOf(container: Container, orderId: string): Promise<OrderRow | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "customer_id",
      "shipping_address.first_name",
      "billing_address.first_name",
    ],
    filters: { id: orderId },
  })
  // Typed as the whole Order in CI; only these fields are read
  return (data as unknown as OrderRow[])[0] ?? null
}

const greetingOf = (order: OrderRow): string =>
  personName(order.shipping_address?.first_name) ??
  personName(order.billing_address?.first_name) ??
  GREETING

export const departureVars = (departure: SheetDeparture): BookingDepartureVars => ({
  title: departure.product_title,
  when: departure.when,
  meetingPoint: departure.meeting_point,
  units: departure.units,
})

const recipientsOf = (order: OrderRow) => ({
  recipients: { email: order.email },
  receiverId: order.customer_id,
})

/** The booking's live departures as a confirmation or reminder says them, or null. */
async function bookingMessage(
  container: Container,
  sheet: BookingSheet,
  departures: SheetDeparture[],
  resourceType: string
): Promise<Loaded<BookingVars> | null> {
  const order = await orderOf(container, sheet.order_id)
  const first = departures[0]
  if (!order || !first) {
    return null
  }
  return {
    vars: {
      number: String(order.display_id),
      customerName: greetingOf(order),
      departures: departures.map(departureVars),
      when: first.when,
      terms: first.terms.map((term) => ({ days: term.days_before, percent: term.fee_percent })),
      voucherUrl: await orderUrlOf(container, order, "/voucher"),
      orderUrl: await orderUrlOf(container, order),
    },
    ...recipientsOf(order),
    resourceType,
  }
}

/** "Rezervasyonunuz onaylandı" for a confirmed booking; its voucher code made now. */
export async function loadBookingConfirmed(
  container: Container,
  bookingId: string
): Promise<Loaded<BookingVars> | null> {
  const sheet = await bookingSheet(container, bookingId)
  const live = sheet?.departures.filter((each) => !each.cancelled) ?? []
  if (sheet?.status !== "confirmed" || live.length === 0) {
    logger.info({
      event: "messaging.not_sent",
      template: "booking.confirmed",
      reason: "no_booking",
    })
    return null
  }
  await container.resolve<BookingModuleService>(BOOKING_MODULE).ensureVoucher(sheet.booking_id)
  return bookingMessage(container, sheet, live, "booking")
}

/** The departure a use row is, on its booking's sheet. */
async function departureOf(container: Container, useId: string) {
  const [use] = await container
    .resolve<BookingModuleService>(BOOKING_MODULE)
    .listBookingSlotUses({ id: useId }, { take: 1, select: ["id", "booking_id"] })
  const sheet = use ? await bookingSheet(container, use.booking_id) : null
  const departure = sheet?.departures.find((each) => each.use_id === useId)
  return sheet && departure ? { sheet, departure } : null
}

/** "Kalkışınız yaklaşıyor" for one departure; none once it is cancelled or past. */
export async function loadBookingReminder(
  container: Container,
  useId: string,
  now = new Date()
): Promise<Loaded<BookingVars> | null> {
  const found = await departureOf(container, useId)
  if (!found || found.departure.cancelled || found.departure.starts_at <= now) {
    logger.info({ event: "messaging.not_sent", template: "booking.reminder", reason: "not_live" })
    return null
  }
  return bookingMessage(container, found.sheet, [found.departure], "booking_slot_use")
}

const KURUS = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" })

/** What the departure's refund sent back, in lira, from the refunds' ledger; null: none. */
async function refundOf(container: Container, useId: string): Promise<string | null> {
  const [entry] = await container
    .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    .listOrderRefunds({ reference: bookingCancelReference(useId) }, { take: 1 })
  const amount = entry && entry.status !== "failed" ? entry.amount : 0
  return amount > 0 ? KURUS.format(amount / 100) : null
}

/**
 * A cancelled departure's message (the shopper's, staff's, or the whole
 * departure the shop called off): the refund from the ledger, or that the
 * shop gives it back by hand (`extra.by_hand`, the event's word).
 */
export async function loadBookingCancel(
  container: Container,
  useId: string,
  extra: Readonly<Record<string, string>>
): Promise<Loaded<BookingCancelVars> | null> {
  const found = await departureOf(container, useId)
  const order = found?.departure.cancelled ? await orderOf(container, found.sheet.order_id) : null
  if (!found || !order) {
    return null
  }
  const byHand = extra["by_hand"] === "1"
  return {
    vars: {
      number: String(order.display_id),
      customerName: greetingOf(order),
      departure: departureVars(found.departure),
      refund: byHand ? null : await refundOf(container, useId),
      byHand,
      orderUrl: await orderUrlOf(container, order),
    },
    ...recipientsOf(order),
    resourceType: "booking_slot_use",
  }
}
