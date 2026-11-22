import type { BookingCategoryView, BookingDepartureView, BookingView } from "@qticaret/ui"

/**
 * A dated product's picks worked out in the browser (adr/0076 §10): which
 * departures can be picked, how many places the counts take, what the
 * counts may grow to and the total shown. All of it a hint: the server
 * checks the places and prices the lines again (CLAUDE.md rule 5).
 */

/** Free units (pax 0, an infant on a lap) per unit that takes a place, as the server allows. */
export const FREE_PER_SEAT = 2

export type Counts = Record<string, number>

/** Open, with a place free and a price for at least one category. */
export const isBookable = (departure: BookingDepartureView): boolean =>
  departure.status === "open" && departure.available > 0 && departure.prices.length > 0

/** The departure the form opens on: the soonest that can be picked. */
export const firstBookable = (view: BookingView): string | null =>
  view.departures.find(isBookable)?.id ?? null

/** One unit of the first category that takes a place; the rest none. */
export function initialCounts(categories: readonly BookingCategoryView[]): Counts {
  const first = categories.find((category) => category.pax > 0) ?? categories[0]
  return Object.fromEntries(
    categories.map((category) => [category.variantId, category === first ? 1 : 0])
  )
}

/** Places the counts take. */
export const placesOf = (categories: readonly BookingCategoryView[], counts: Counts): number =>
  categories.reduce((sum, category) => sum + (counts[category.variantId] ?? 0) * category.pax, 0)

const seatsOf = (categories: readonly BookingCategoryView[], counts: Counts): number =>
  categories.reduce(
    (sum, category) => sum + (category.pax > 0 ? (counts[category.variantId] ?? 0) : 0),
    0
  )

const freeOf = (categories: readonly BookingCategoryView[], counts: Counts): number =>
  categories.reduce(
    (sum, category) => sum + (category.pax === 0 ? (counts[category.variantId] ?? 0) : 0),
    0
  )

/** The most places this cart may take on the departure: its free places, the shop's cap. */
export const roomOn = (view: BookingView, departure: BookingDepartureView | null): number =>
  departure ? Math.max(0, Math.min(departure.available, view.maxUnits)) : 0

const priced = (departure: BookingDepartureView | null, variantId: string): boolean =>
  departure?.prices.some((price) => price.variantId === variantId) ?? false

/** Whether one more of the category fits: a price here, room for its places, infants per seat. */
export function canAddOne(
  view: BookingView,
  departure: BookingDepartureView | null,
  category: BookingCategoryView,
  counts: Counts
): boolean {
  if (!departure || !isBookable(departure) || !priced(departure, category.variantId)) {
    return false
  }
  if (category.pax === 0) {
    return freeOf(view.categories, counts) + 1 <= seatsOf(view.categories, counts) * FREE_PER_SEAT
  }
  return placesOf(view.categories, counts) + category.pax <= roomOn(view, departure)
}

/**
 * The counts held to the departure: a category without a price here goes
 * to none, places past the room are taken off the last categories first,
 * infants past their seats too.
 */
export function fitCounts(
  view: BookingView,
  departure: BookingDepartureView | null,
  counts: Counts
): Counts {
  const fitted: Counts = {}
  let room = roomOn(view, departure)
  for (const category of view.categories) {
    const asked = priced(departure, category.variantId) ? (counts[category.variantId] ?? 0) : 0
    if (category.pax === 0) {
      fitted[category.variantId] = asked
      continue
    }
    const kept = Math.max(0, Math.min(asked, Math.floor(room / category.pax)))
    fitted[category.variantId] = kept
    room -= kept * category.pax
  }
  let free = seatsOf(view.categories, fitted) * FREE_PER_SEAT
  for (const category of view.categories) {
    if (category.pax === 0) {
      const kept = Math.min(fitted[category.variantId] ?? 0, free)
      fitted[category.variantId] = kept
      free -= kept
    }
  }
  return fitted
}

/** People counted (every unit, a free one too). */
export const peopleOf = (counts: Counts): number =>
  Object.values(counts).reduce((sum, count) => sum + count, 0)

/** The total shown, in kuruş; null without a departure or anyone picked. */
export function totalKurus(departure: BookingDepartureView | null, counts: Counts): number | null {
  if (!departure || peopleOf(counts) === 0) {
    return null
  }
  return departure.prices.reduce(
    (sum, price) => sum + price.kurus * (counts[price.variantId] ?? 0),
    0
  )
}
