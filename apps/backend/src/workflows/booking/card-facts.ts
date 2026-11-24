import type { MedusaContainer } from "@medusajs/framework/types"
import {
  STORE_SLOTS_LIMIT,
  adjustmentOf,
  adjustmentProblem,
  bookingUnitPrice,
  salesClosed,
} from "../../lib/booking/cart-lines"
import { payingCategoryIds } from "../../lib/booking/categories"
import type { Kurus } from "../../lib/money"
import type { DepartureDates, SlotAvailability } from "../../modules/booking/service"
import {
  baseAmounts,
  basePriceRows,
  lira,
  lowestShown,
  placeDisplays,
  pricingOf,
  struck,
} from "./card-price"
import type { CardShown } from "./card-price"
import { bookingService } from "./cart/target"

type Container = Pick<MedusaContainer, "resolve">

/**
 * What a dated product's card says (adr/0076 §10, Ek "D5 takip: kart
 * fiyatı"): the lowest price the main paying category sells at, the
 * automatic promotions every shopper gets taken off (Ek "kart fiyatı
 * promosyonlu"), in the currency's amount ("1750.5"), and the nearest
 * departure still on sale with a place free; each null when there is
 * none. Worked out on the server, a guest's price, as the product page's
 * departures are.
 */
export interface BookingCardFact {
  from_price: number | null
  /**
   * The same unit's price struck through, only when the price-before rule
   * lets it be shown as a discount (an ordinary card's `before`, F4.3),
   * never on a departure with a difference (no record of it, card-price.ts);
   * absent otherwise.
   */
  before?: number
  currency_code: string
  /** ISO time; the card says it in `timezone`. */
  next_departure: string | null
  timezone: string
  /**
   * A date search's card only (adr/0077 §4): the places left on
   * `next_departure` (null without one), and `in_range`: the departure
   * and the from price are those inside the dates asked.
   */
  left?: number | null
  in_range?: true
  /** The tour's length in whole days, from its length attribute (adr/0077 Ek "tur kartı"); absent without one. */
  duration_days?: number
}

/** A date search's dates and party, as the card facts read them (adr/0077 §4). */
export interface CardWindow {
  dates: DepartureDates
  pax: number
}

/** A dated product as the card facts read it. */
export interface DatedCardProduct {
  id: string
  variants?: ({ id: string; variant_rank?: number | null } | null)[] | null
  product_extension?: { booking_mode?: string | null } | null
  bookable?:
    | {
        id: string
        cutoff_hours: number
        pax_by_variant: unknown
        timezone: string
      }
    | null
    | undefined
}

/** A place's price before the promotions: its category, and the departure's difference on its base. */
export interface PayingUnit {
  variant_id: string
  adjustment: number
  amount: Kurus
}

/** Its paying price categories, the main one first (an infant who takes no place is not a "from" price). */
export function payingVariants(product: DatedCardProduct): string[] {
  return payingCategoryIds(product.variants, product.bookable?.pax_by_variant)
}

/**
 * What a place sells at on a departure with these differences (none: the
 * base prices alone): the main paying category's base plus the
 * departure's difference (adr/0076 Ek "kart fiyatı ana kategoriden": the
 * adult's, not a cheaper child's). A category without a base price, or
 * whose difference this currency cannot take, has none and the next one
 * in the shop's order speaks; none at all: null.
 */
export function payingUnitAt(
  product: DatedCardProduct,
  bases: ReadonlyMap<string, Kurus | null>,
  adjustments: Record<string, number> | null,
  currencyCode: string
): PayingUnit | null {
  for (const variantId of payingVariants(product)) {
    const base = bases.get(variantId)
    if (base === null || base === undefined) {
      continue
    }
    const adjustment = adjustmentOf(adjustments, variantId)
    if (!adjustmentProblem(currencyCode, adjustment)) {
      return { variant_id: variantId, adjustment, amount: bookingUnitPrice(base, adjustment) }
    }
  }
  return null
}

/** The departures on sale now: open, with a place free, sales not closed. */
function sellingSlots(
  slots: readonly SlotAvailability[],
  cutoffHours: number,
  now: Date
): SlotAvailability[] {
  return slots.filter(
    (slot) =>
      slot.status === "open" && slot.available > 0 && !salesClosed(slot.starts_at, cutoffHours, now)
  )
}

/**
 * The places a dated card's price is the lowest of, before the
 * promotions: for each paying category that speaks, its lowest unit over
 * the departures on sale (each one's difference added), or its base
 * price without one. A promotion takes no more off a lower price of the
 * same category, so its lowest unit is its lowest price after it too.
 */
export function cardUnits(
  product: DatedCardProduct,
  bases: ReadonlyMap<string, Kurus | null>,
  slots: readonly SlotAvailability[],
  currencyCode: string,
  now: Date
): PayingUnit[] {
  const bookable = product.bookable
  if (!bookable) {
    return []
  }
  const selling = sellingSlots(slots, bookable.cutoff_hours, now)
  const units = (selling.length > 0 ? selling.map((slot) => slot.price_adjustments) : [null])
    .map((adjustments) => payingUnitAt(product, bases, adjustments, currencyCode))
    .filter((unit): unit is PayingUnit => unit !== null)
  const lowest = new Map<string, PayingUnit>()
  for (const unit of units) {
    const known = lowest.get(unit.variant_id)
    if (!known || unit.amount < known.amount) {
      lowest.set(unit.variant_id, unit)
    }
  }
  return [...lowest.values()]
}

/**
 * A dated card's fact from its base prices and its open slots (by start):
 * the first slot whose sales are not closed is the next departure; the
 * from price is the lowest of its places (`cardUnits`) as shown (`shown`,
 * by `placeKey`: the automatic promotions taken off, the price before
 * them when the price-before rule allows); a place without a display is
 * its own price. `shown` has no default, here and in the calendar, the
 * upcoming departures and the structured data: a caller that left it out
 * would say a price without the promotions the cart takes off.
 */
export function bookingCardFactOf(
  product: DatedCardProduct,
  bases: ReadonlyMap<string, Kurus | null>,
  slots: readonly SlotAvailability[],
  currencyCode: string,
  now: Date,
  inRange: boolean,
  shown: ReadonlyMap<string, CardShown>
): BookingCardFact | null {
  const bookable = product.bookable
  if (!bookable || product.product_extension?.booking_mode !== "departure") {
    return null
  }
  const selling = sellingSlots(slots, bookable.cutoff_hours, now)
  const lowest = lowestShown(cardUnits(product, bases, slots, currencyCode, now), shown)
  const fact: BookingCardFact = {
    from_price: lowest === null ? null : lira(lowest.current),
    ...struck(lowest),
    currency_code: currencyCode,
    next_departure: selling[0]?.starts_at.toISOString() ?? null,
    timezone: bookable.timezone,
  }
  return inRange ? { ...fact, left: selling[0]?.available ?? null, in_range: true } : fact
}

/**
 * The card facts of a page's dated products (adr/0076 §10): one region
 * read, one price read for all their categories, one slot read for all
 * their departures and one promotions' reading for all their places,
 * whatever the page's size. Products that are not dated (or have no
 * booking settings yet) are left out. With a date search's `window`
 * (adr/0077 §4) the departures read are those inside its dates with room
 * for its party: the next one is the nearest of them and the from price is
 * over them, the date search's price sort and filter included
 * (listing-dated-prices.ts).
 */
export async function bookingCardFacts(
  container: Container,
  products: readonly DatedCardProduct[],
  regionId: string | undefined,
  window?: CardWindow
): Promise<Map<string, BookingCardFact>> {
  const dated = products.filter(
    (product) => product.bookable && product.product_extension?.booking_mode === "departure"
  )
  if (dated.length === 0) {
    return new Map()
  }
  const now = new Date()
  const pricing = await pricingOf(container, regionId)
  const bookableIds = dated.flatMap((product) => (product.bookable ? [product.bookable.id] : []))
  const service = bookingService(container)
  const [rows, slots] = await Promise.all([
    basePriceRows(container, dated.flatMap(payingVariants), pricing),
    window
      ? service.windowSlots(bookableIds, { ...window, now }, STORE_SLOTS_LIMIT)
      : service.openSlots(bookableIds, { from: now, limit: STORE_SLOTS_LIMIT }),
  ])
  const bases = baseAmounts(rows)
  const slotsOf = (product: DatedCardProduct) =>
    slots.filter((slot) => slot.bookable_id === product.bookable?.id)
  const units = dated.flatMap((product) =>
    cardUnits(product, bases, slotsOf(product), pricing.currency_code, now)
  )
  const shown = await placeDisplays(container, units, rows, pricing.currency_code, now)
  const facts = new Map<string, BookingCardFact>()
  for (const product of dated) {
    const fact = bookingCardFactOf(
      product,
      bases,
      slotsOf(product),
      pricing.currency_code,
      now,
      !!window,
      shown
    )
    if (fact) {
      facts.set(product.id, fact)
    }
  }
  return facts
}
