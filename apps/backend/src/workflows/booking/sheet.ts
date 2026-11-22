import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { cancellationTermsOf } from "../../lib/booking/cancellation"
import { MEETING_POINT_KEYS, departureTime, termLines } from "../../lib/booking/message-facts"
import type { TermLine } from "../../lib/booking/message-facts"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import { returnPolicy } from "../returns/policy"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A booking as its messages, its voucher and the panel's code check read
 * it (adr/0076 §8, Ek D7b): the product and the departures, with places
 * counted, never a traveler's name. Times are written in the zone the
 * booking was sold in.
 */

export interface SheetDeparture {
  use_id: string
  slot_id: string
  product_title: string
  /** The product's public "Kalkış yeri" attribute, if it has one. */
  meeting_point: string | null
  starts_at: Date
  /** `starts_at` written out in the product's zone. */
  when: string
  timezone: string
  units: number
  /** This departure cancelled (the shopper's, staff's or the shop's whole departure). */
  cancelled: boolean
  reminded: boolean
  reminder_days: number
  terms: TermLine[]
}

export interface BookingSheet {
  booking_id: string
  order_id: string
  status: string
  created_at: Date
  departures: SheetDeparture[]
}

interface AttributeRow {
  value_text?: string | null
  definition?: { key?: string | null; is_public?: boolean | null; type?: string | null } | null
}

interface ProductRow {
  id: string
  title?: string | null
  attribute_values?: (AttributeRow | null)[] | null
}

function meetingPointOf(product: ProductRow | undefined): string | null {
  for (const key of MEETING_POINT_KEYS) {
    const value = (product?.attribute_values ?? []).find(
      (each) => each?.definition?.key === key && each.definition.is_public !== false
    )
    const text = (value?.value_text ?? "").trim().slice(0, 200)
    if (text !== "") {
      return text
    }
  }
  return null
}

async function productsOf(container: Container, ids: string[]): Promise<Map<string, ProductRow>> {
  if (ids.length === 0) {
    return new Map()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "attribute_values.value_text",
      "attribute_values.definition.key",
      "attribute_values.definition.is_public",
      "attribute_values.definition.type",
    ],
    filters: { id: ids },
  })
  return new Map((data as ProductRow[]).map((row) => [row.id, row]))
}

/** The booking's sheet, or null when there is no such booking. */
export async function bookingSheet(
  container: Container,
  bookingId: string
): Promise<BookingSheet | null> {
  const service = container.resolve<BookingModuleService>(BOOKING_MODULE)
  const [booking] = await service.listBookings({ id: bookingId }, { take: 1 })
  if (!booking) {
    return null
  }
  const uses = await service.listBookingSlotUses({ booking_id: booking.id })
  const slots = uses.length
    ? await service.listBookingSlots({ id: uses.map((use) => use.slot_id) })
    : []
  const bookables = slots.length
    ? await service.listBookables({ id: [...new Set(slots.map((slot) => slot.bookable_id))] })
    : []
  const [products, policy] = await Promise.all([
    productsOf(container, [...new Set(bookables.map((each) => each.product_id))]),
    returnPolicy(container as MedusaContainer),
  ])
  const departures = uses.flatMap((use): SheetDeparture[] => {
    const slot = slots.find((each) => each.id === use.slot_id)
    const bookable = slot && bookables.find((each) => each.id === slot.bookable_id)
    if (!slot || !bookable) {
      return []
    }
    const product = products.get(bookable.product_id)
    const terms = cancellationTermsOf(use.cancellation, {
      timezone: bookable.timezone,
      tiers: bookable.cancellation_tiers,
    })
    const startsAt = new Date(slot.starts_at)
    return [
      {
        use_id: use.id,
        slot_id: slot.id,
        product_title: (product?.title ?? "").trim(),
        meeting_point: meetingPointOf(product),
        starts_at: startsAt,
        when: departureTime(startsAt, terms.timezone),
        timezone: terms.timezone,
        units: use.units,
        cancelled:
          use.cancelled_at !== null ||
          booking.status === "cancelled" ||
          slot.status === "cancelled",
        reminded: use.reminded_at !== null,
        reminder_days: bookable.reminder_days,
        terms: termLines(terms.tiers, policy.package_travel),
      },
    ]
  })
  departures.sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime())
  return {
    booking_id: booking.id,
    order_id: booking.order_id,
    status: booking.status,
    created_at: new Date(booking.created_at),
    departures,
  }
}
