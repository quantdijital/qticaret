import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { messageText } from "../../lib/messaging/texts"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import type { BookingRequestDetails } from "../../modules/contact-messages/service"

type Container = Pick<MedusaContainer, "resolve">

/** What a booking request names, in the open: never the person. */
export interface BookingRequestFacts {
  product: string
  when: string
  people: string
  /** "Rezervasyon talebi: <product>, <when>, <people>." */
  line: string
}

const day = (value: string): string =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`))

const month = (value: string): string =>
  new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}-01T00:00:00Z`)
  )

/** How many people, as staff read it: "2 yetişkin, 1 çocuk". */
export function peopleText(details: BookingRequestDetails): string {
  const adults = messageText("staff_contact.booking_adults", { count: details.adults })
  return details.children
    ? `${adults}, ${messageText("staff_contact.booking_children", { count: details.children })}`
    : adults
}

async function departureText(container: Container, slotId: string): Promise<string | null> {
  const booking = container.resolve<BookingModuleService>(BOOKING_MODULE)
  const [slot] = await booking.listBookingSlots({ id: slotId }, { take: 1 })
  if (!slot) {
    return null
  }
  const [bookable] = await booking.listBookables({ id: slot.bookable_id }, { take: 1 })
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: bookable?.timezone ?? "Europe/Istanbul",
  }).format(new Date(slot.starts_at))
}

/** When the request is for: a departure, a day, a month, or open dates. */
async function whenText(container: Container, details: BookingRequestDetails): Promise<string> {
  if (details.slot_id) {
    const departure = await departureText(container, details.slot_id)
    if (departure) {
      return departure
    }
  }
  if (details.date) {
    return day(details.date)
  }
  if (details.month) {
    return month(details.month)
  }
  return messageText("staff_contact.booking_flexible")
}

/**
 * A booking request's product, dates and people in words, for the shop's
 * bell and e-mail (adr/0076 Ek 2026-11-23). Null when the message is not
 * one, or its product is gone.
 */
export async function bookingRequestFacts(
  container: Container,
  message: { product_id?: string | null; details?: unknown }
): Promise<BookingRequestFacts | null> {
  const details = message.details as BookingRequestDetails | null | undefined
  if (!message.product_id || !details) {
    return null
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "title"],
    filters: { id: message.product_id },
  })
  const product = (data[0] as { title?: string | null } | undefined)?.title
  if (!product) {
    return null
  }
  const when = await whenText(container, details)
  const people = peopleText(details)
  return {
    product,
    when,
    people,
    line: messageText("staff_contact.booking_request", { product, when, people }),
  }
}
