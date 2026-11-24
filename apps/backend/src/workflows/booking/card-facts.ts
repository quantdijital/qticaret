import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"
import {
  STORE_SLOTS_LIMIT,
  adjustmentOf,
  adjustmentProblem,
  bookingUnitPrice,
  salesClosed,
} from "../../lib/booking/cart-lines"
import { payingCategoryIds } from "../../lib/booking/categories"
import { fromMedusaAmount, toMedusaAmount } from "../../lib/money"
import type { Kurus, MedusaAmount } from "../../lib/money"
import type { DepartureDates, SlotAvailability } from "../../modules/booking/service"
import { bookingService } from "./cart/target"

type Container = Pick<MedusaContainer, "resolve">

/**
 * What a dated product's card says (adr/0076 §10, Ek "D5 takip: kart
 * fiyatı"): the lowest price the main paying category sells at, in the currency's
 * amount ("1750.5"), and the nearest departure still on sale with a place
 * free; each null when there is none. Worked out on the server, a guest's
 * price, as the product page's departures are.
 */
export interface BookingCardFact {
  from_price: number | null
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

/** Kuruş as the currency's amount a shopper reads (1750.5), the card's unit. */
export const lira = (amount: Kurus): number => Number(toMedusaAmount(amount))

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
 * in the shop's order speaks; none at all: no price. One price or none.
 */
export function payingPricesAt(
  product: DatedCardProduct,
  bases: ReadonlyMap<string, Kurus | null>,
  adjustments: Record<string, number> | null,
  currencyCode: string
): Kurus[] {
  for (const variantId of payingVariants(product)) {
    const base = bases.get(variantId)
    if (base === null || base === undefined) {
      continue
    }
    const adjustment = adjustmentOf(adjustments, variantId)
    if (!adjustmentProblem(currencyCode, adjustment)) {
      return [bookingUnitPrice(base, adjustment)]
    }
  }
  return []
}

/**
 * A dated card's fact from its base prices and its open slots (by start):
 * the first slot whose sales are not closed is the next departure; the
 * from price is the lowest over those slots of the main paying category
 * (each slot's difference added), or over the base prices without one.
 */
export function bookingCardFactOf(
  product: DatedCardProduct,
  bases: ReadonlyMap<string, Kurus | null>,
  slots: readonly SlotAvailability[],
  currencyCode: string,
  now: Date,
  inRange = false
): BookingCardFact | null {
  const bookable = product.bookable
  if (!bookable || product.product_extension?.booking_mode !== "departure") {
    return null
  }
  const selling = slots.filter(
    (slot) =>
      slot.status === "open" &&
      slot.available > 0 &&
      !salesClosed(slot.starts_at, bookable.cutoff_hours, now)
  )
  const pricesAt = (adjustments: Record<string, number> | null): Kurus[] =>
    payingPricesAt(product, bases, adjustments, currencyCode)
  const prices =
    selling.length > 0
      ? selling.flatMap((slot) => pricesAt(slot.price_adjustments))
      : pricesAt(null)
  const lowest = prices.length > 0 ? Math.min(...prices) : null
  const fact: BookingCardFact = {
    from_price: lowest === null ? null : lira(lowest as Kurus),
    currency_code: currencyCode,
    next_departure: selling[0]?.starts_at.toISOString() ?? null,
    timezone: bookable.timezone,
  }
  return inRange ? { ...fact, left: selling[0]?.available ?? null, in_range: true } : fact
}

/** The region's currency, else lira; an unknown region prices as none. */
async function pricingOf(container: Container, regionId: string | undefined) {
  if (!regionId) {
    return { currency_code: "try" }
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "region",
    fields: ["id", "currency_code"],
    filters: { id: regionId },
  })
  const region = data[0] as { id: string; currency_code: string } | undefined
  return region
    ? { currency_code: region.currency_code, region_id: region.id }
    : { currency_code: "try" }
}

/** Base prices for many variants in one read, a guest's, in the pricing given. */
export async function basePrices(
  container: Container,
  variantIds: readonly string[],
  pricing: { currency_code: string; region_id?: string }
): Promise<Map<string, Kurus | null>> {
  if (variantIds.length === 0) {
    return new Map()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: ["id", "calculated_price.calculated_amount"],
    filters: { id: [...variantIds] },
    context: { calculated_price: QueryContext({ ...pricing, quantity: 1 }) },
  })
  return new Map(
    (data as { id: string; calculated_price?: { calculated_amount?: unknown } | null }[]).map(
      (row): [string, Kurus | null] => {
        const amount = row.calculated_price?.calculated_amount
        return [
          row.id,
          amount === null || amount === undefined
            ? null
            : fromMedusaAmount(amount as MedusaAmount, { allowRounding: true }),
        ]
      }
    )
  )
}

/**
 * The card facts of a page's dated products (adr/0076 §10): one region
 * read, one price read for all their categories and one slot read for all
 * their departures, whatever the page's size. Products that are not dated
 * (or have no booking settings yet) are left out. With a date search's
 * `window` (adr/0077 §4) the departures read are those inside its dates
 * with room for its party: the next one is the nearest of them and the
 * from price is over them.
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
  const [bases, slots] = await Promise.all([
    basePrices(container, dated.flatMap(payingVariants), pricing),
    window
      ? service.windowSlots(bookableIds, { ...window, now }, STORE_SLOTS_LIMIT)
      : service.openSlots(bookableIds, { from: now, limit: STORE_SLOTS_LIMIT }),
  ])
  const facts = new Map<string, BookingCardFact>()
  for (const product of dated) {
    const own = slots.filter((slot) => slot.bookable_id === product.bookable?.id)
    const fact = bookingCardFactOf(product, bases, own, pricing.currency_code, now, !!window)
    if (fact) {
      facts.set(product.id, fact)
    }
  }
  return facts
}
