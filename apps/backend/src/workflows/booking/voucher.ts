import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { formatVoucherCode, normalizeVoucherCode } from "../../lib/booking/voucher-code"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import { bookingSheet } from "./sheet"
import type { BookingSheet } from "./sheet"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A booking's voucher (adr/0076 §8, §13, Ek D7b): the order's number, the
 * departures with their places and the check code; no name, no birth
 * date, no document. The shopper reads theirs from the order's page;
 * staff type the code to see whether the booking stands.
 */

export interface VoucherDeparture {
  title: string
  when: string
  starts_at: string
  meeting_point: string | null
  units: number
  cancelled: boolean
}

export type VoucherStatus = "valid" | "cancelled"

export interface VoucherView {
  order_number: string
  status: VoucherStatus
  /** `ABCD-EFGH-JKMN-PQRS`. */
  code: string
  departures: VoucherDeparture[]
}

const departuresOf = (sheet: BookingSheet): VoucherDeparture[] =>
  sheet.departures.map((departure) => ({
    title: departure.product_title,
    when: departure.when,
    starts_at: departure.starts_at.toISOString(),
    meeting_point: departure.meeting_point,
    units: departure.units,
    cancelled: departure.cancelled,
  }))

/** Valid while one of its departures is: a booking cancelled whole, or each departure, is not. */
export const voucherStatusOf = (sheet: BookingSheet): VoucherStatus =>
  sheet.status === "confirmed" && sheet.departures.some((each) => !each.cancelled)
    ? "valid"
    : "cancelled"

async function orderNumberOf(container: Container, orderId: string): Promise<string | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "display_id"],
    filters: { id: orderId },
  })
  const order = (data as { display_id?: number | null }[])[0]
  return order?.display_id ? String(order.display_id) : null
}

/** The order's vouchers, one a booking, each code made on first read; none: no booking. */
export async function orderVouchers(container: Container, orderId: string): Promise<VoucherView[]> {
  const service = container.resolve<BookingModuleService>(BOOKING_MODULE)
  const bookings = await service.listBookings({ order_id: orderId }, { select: ["id"] })
  const number = bookings.length ? await orderNumberOf(container, orderId) : null
  const views: VoucherView[] = []
  for (const booking of bookings) {
    const sheet = await bookingSheet(container, booking.id)
    const code = sheet && number ? await service.ensureVoucher(booking.id) : null
    if (sheet && number && code) {
      views.push({
        order_number: number,
        status: voucherStatusOf(sheet),
        code: formatVoucherCode(code),
        departures: departuresOf(sheet),
      })
    }
  }
  return views
}

/** What staff see for a typed code: the booking, or that there is none (nothing else said). */
export type VoucherCheck =
  | { status: "unknown" }
  | {
      status: VoucherStatus
      booking_id: string
      order_id: string
      order_number: string
      departures: VoucherDeparture[]
    }

export async function checkVoucher(container: Container, typed: unknown): Promise<VoucherCheck> {
  const code = normalizeVoucherCode(typed)
  if (!code) {
    return { status: "unknown" }
  }
  const booking = await container
    .resolve<BookingModuleService>(BOOKING_MODULE)
    .bookingByVoucher(code)
  const sheet = booking ? await bookingSheet(container, booking.id) : null
  const number = sheet ? await orderNumberOf(container, sheet.order_id) : null
  if (!sheet || !number) {
    return { status: "unknown" }
  }
  return {
    status: voucherStatusOf(sheet),
    booking_id: sheet.booking_id,
    order_id: sheet.order_id,
    order_number: number,
    departures: departuresOf(sheet),
  }
}
