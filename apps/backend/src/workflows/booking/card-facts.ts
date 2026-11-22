import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"
import {
  STORE_SLOTS_LIMIT,
  adjustmentOf,
  adjustmentProblem,
  bookingUnitPrice,
  paxOf,
  salesClosed,
} from "../../lib/booking/cart-lines"
import { fromMedusaAmount, toMedusaAmount } from "../../lib/money"
import type { Kurus, MedusaAmount } from "../../lib/money"
import type { SlotAvailability } from "../../modules/booking/service"
import { bookingService } from "./cart/target"

type Container = Pick<MedusaContainer, "resolve">

/**
 * What a dated product's card says (adr/0076 §10, Ek "D5 takip: kart
 * fiyatı"): the lowest price a paying place sells at, in the currency's
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
}

/** A dated product as the card facts read it. */
export interface DatedCardProduct {
  id: string
  variants?: ({ id: string } | null)[] | null
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

const lira = (amount: Kurus): number => Number(toMedusaAmount(amount))

/** Its paying price categories (an infant who takes no place is not a "from" price). */
function payingVariants(product: DatedCardProduct): string[] {
  const ids = (product.variants ?? []).flatMap((variant) => (variant ? [variant.id] : []))
  const paying = ids.filter((id) => paxOf(product.bookable?.pax_by_variant, id) > 0)
  // A product whose every category takes no place still has a price to show
  return paying.length > 0 ? paying : ids
}

/**
 * A dated card's fact from its base prices and its open slots (by start):
 * the first slot whose sales are not closed is the next departure; the
 * from price is the lowest over those slots and the paying categories
 * (each slot's difference added), or over the base prices without one.
 */
export function bookingCardFactOf(
  product: DatedCardProduct,
  bases: ReadonlyMap<string, Kurus | null>,
  slots: readonly SlotAvailability[],
  currencyCode: string,
  now: Date
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
  const variants = payingVariants(product)
  const pricesAt = (slot: SlotAvailability | null): Kurus[] =>
    variants.flatMap((variantId) => {
      const base = bases.get(variantId)
      if (base === null || base === undefined) {
        return []
      }
      const adjustment = slot ? adjustmentOf(slot.price_adjustments, variantId) : 0
      return adjustmentProblem(currencyCode, adjustment) ? [] : [bookingUnitPrice(base, adjustment)]
    })
  const prices = selling.length > 0 ? selling.flatMap(pricesAt) : pricesAt(null)
  const lowest = prices.length > 0 ? Math.min(...prices) : null
  return {
    from_price: lowest === null ? null : lira(lowest as Kurus),
    currency_code: currencyCode,
    next_departure: selling[0]?.starts_at.toISOString() ?? null,
    timezone: bookable.timezone,
  }
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
async function basePrices(
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
 * (or have no booking settings yet) are left out.
 */
export async function bookingCardFacts(
  container: Container,
  products: readonly DatedCardProduct[],
  regionId: string | undefined
): Promise<Map<string, BookingCardFact>> {
  const dated = products.filter(
    (product) => product.bookable && product.product_extension?.booking_mode === "departure"
  )
  if (dated.length === 0) {
    return new Map()
  }
  const now = new Date()
  const pricing = await pricingOf(container, regionId)
  const [bases, slots] = await Promise.all([
    basePrices(container, dated.flatMap(payingVariants), pricing),
    bookingService(container).openSlots(
      dated.flatMap((product) => (product.bookable ? [product.bookable.id] : [])),
      { from: now, limit: STORE_SLOTS_LIMIT }
    ),
  ])
  const facts = new Map<string, BookingCardFact>()
  for (const product of dated) {
    const own = slots.filter((slot) => slot.bookable_id === product.bookable?.id)
    const fact = bookingCardFactOf(product, bases, own, pricing.currency_code, now)
    if (fact) {
      facts.set(product.id, fact)
    }
  }
  return facts
}
