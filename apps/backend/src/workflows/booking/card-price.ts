import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"
import { bookingUnitPrice } from "../../lib/booking/cart-lines"
import { fromMedusaAmount } from "../../lib/money"
import type { Kurus, MedusaAmount } from "../../lib/money"
import { unitDisplays } from "../pricing/price-display"
import type { UnitPrice } from "../pricing/price-display"
import type { PayingUnit } from "./card-facts"

/**
 * A dated card's prices read (adr/0076 §10, Ek "kart fiyatı
 * promosyonlu"): its categories' base prices, a guest's, and how its
 * places are shown once the automatic promotions every shopper gets are
 * taken off. The promotion is worked out by the storefront's own price
 * display (`unitDisplays`, the index's price read too), on the place's
 * unit price (base plus the departure's difference), as the cart's line
 * gets it: one rule for the card, the date search's price and the index.
 */

type Container = Pick<MedusaContainer, "resolve">

/** A category's base price now and its regular price (before a sale list). */
export interface BasePrice {
  calculated: Kurus
  original: Kurus
}

/** A place as its card shows it: its price, and the price struck through when the rule allows. */
export interface CardShown {
  current: Kurus
  before: Kurus | null
}

const toKurus = (amount: MedusaAmount) => fromMedusaAmount(amount, { allowRounding: true })

/** The region's currency, else lira; an unknown region prices as none. */
export async function pricingOf(
  container: Container,
  regionId: string | undefined
): Promise<{ currency_code: string; region_id?: string }> {
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

interface PriceRow {
  id: string
  calculated_price?: {
    calculated_amount?: MedusaAmount | null
    original_amount?: MedusaAmount | null
  } | null
}

/** Base and regular prices for many variants in one read, a guest's, in the pricing given. */
export async function basePriceRows(
  container: Container,
  variantIds: readonly string[],
  pricing: { currency_code: string; region_id?: string }
): Promise<Map<string, BasePrice | null>> {
  if (variantIds.length === 0) {
    return new Map()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: ["id", "calculated_price.calculated_amount", "calculated_price.original_amount"],
    filters: { id: [...variantIds] },
    context: { calculated_price: QueryContext({ ...pricing, quantity: 1 }) },
  })
  return new Map(
    (data as PriceRow[]).map((row): [string, BasePrice | null] => {
      const amount = row.calculated_price?.calculated_amount
      if (amount === null || amount === undefined) {
        return [row.id, null]
      }
      const original = row.calculated_price?.original_amount
      const calculated = toKurus(amount)
      return [
        row.id,
        {
          calculated,
          original: original === null || original === undefined ? calculated : toKurus(original),
        },
      ]
    })
  )
}

/** Base prices for many variants in one read, a guest's, in the pricing given. */
export async function basePrices(
  container: Container,
  variantIds: readonly string[],
  pricing: { currency_code: string; region_id?: string }
): Promise<Map<string, Kurus | null>> {
  const rows = await basePriceRows(container, variantIds, pricing)
  return new Map([...rows].map(([id, row]) => [id, row?.calculated ?? null]))
}

/**
 * How each place (one per category) is shown: its unit price less the
 * automatic promotions on its category, never below zero, and the price
 * before them struck through only by the price-before rule, read from the
 * category's recorded prices. A departure's difference has no record of
 * its own (a difference raised yesterday would make a price never sold
 * look cut, Ticari Reklam Yönetmeliği md. 14/3), so a place priced with
 * one is never struck through: its promoted price alone. By category.
 */
export async function cardUnitDisplays(
  container: Container,
  units: readonly PayingUnit[],
  bases: ReadonlyMap<string, BasePrice | null>,
  currencyCode: string,
  now: Date
): Promise<Map<string, CardShown>> {
  const priced = new Map<string, UnitPrice>()
  const differs = new Set<string>()
  for (const unit of units) {
    const base = bases.get(unit.variant_id)
    if (!base) {
      continue
    }
    if (unit.adjustment !== 0) {
      differs.add(unit.variant_id)
    }
    priced.set(unit.variant_id, {
      amount: unit.amount,
      original: bookingUnitPrice(base.original, unit.adjustment),
    })
  }
  const displays = await unitDisplays(container, priced, currencyCode.toLowerCase(), now)
  return new Map(
    [...displays].map(([id, shown]) => [
      id,
      { current: shown.current, before: differs.has(id) ? null : shown.before },
    ])
  )
}
