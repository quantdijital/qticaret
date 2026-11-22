import type { SlotBooking } from "@/features/products/api/booking"
import { formatSlotStart } from "./slot-dates"

/** "15.01.1990" from the stored `YYYY-MM-DD`; as it is when not a date. */
export function birthDateText(value: string | null, language: string): string | null {
  if (!value) {
    return null
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return value
  }
  const [, year, month, day] = match
  return new Intl.DateTimeFormat(language, { timeZone: "UTC" }).format(
    new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  )
}

/** A country's name in the panel's language ("Türkiye"); its code when unknown. */
export function countryText(code: string | null, language: string): string | null {
  if (!code) {
    return null
  }
  try {
    return new Intl.DisplayNames([language], { type: "region" }).of(code) ?? code
  } catch {
    return code
  }
}

/** The departure in words from the print page's address; nothing when it is not a date or a zone. */
export function whenOf(at: string | undefined, zone: string | undefined, language: string): string {
  if (!at) {
    return ""
  }
  try {
    return formatSlotStart(at, zone ?? "Europe/Istanbul", language)
  } catch {
    return ""
  }
}

/** The travelers to print: booked ones (a cancelled booking's are not on the trip), in order. */
export function printedTravelers(bookings: readonly SlotBooking[]) {
  return bookings
    .filter((booking) => booking.status !== "cancelled")
    .flatMap((booking) =>
      (booking.travelers ?? []).map((traveler) => ({ ...traveler, display_id: booking.display_id }))
    )
}
