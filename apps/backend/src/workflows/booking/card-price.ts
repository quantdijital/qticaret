import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"
import { bookingUnitPrice } from "../../lib/booking/cart-lines"
import { fromMedusaAmount, toMedusaAmount } from "../../lib/money"
import type { Kurus, MedusaAmount } from "../../lib/money"
import { unitDisplays } from "../pricing/price-display"
import type { LinePrice } from "../pricing/price-display"
import type { PayingUnit } from "./card-facts"

/**
 * A dated product's prices read (adr/0076 §10, Ek "kart fiyatı
 * promosyonlu", "kalkış fiyatı promosyonlu"): its categories' base
 * prices, a guest's, and how its places are shown once the automatic
 * promotions every shopper gets are taken off. The promotion is worked
 * out by the storefront's own price display (`unitDisplays`, the index's
 * price read too), on the place's unit price (base plus the departure's
 * difference), as the cart's line gets it: one rule for the card, the
 * date search's price, the index, the page's departures, the calendar,
 * the upcoming departures and the structured data.
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

/** Kuruş as the currency's amount a shopper reads (1750.5), the card's unit. */
export const lira = (amount: Kurus): number => Number(toMedusaAmount(amount))

/** A place's key among departures: its category and the difference (departures alike share one). */
export const placeKey = (unit: Pick<PayingUnit, "variant_id" | "adjustment">): string =>
  `${unit.variant_id}:${String(unit.adjustment)}`

/** A place as shown (`placeDisplays`), its own price when none was worked out for it. */
export const shownOf = (shown: ReadonlyMap<string, CardShown>, unit: PayingUnit): CardShown =>
  shown.get(placeKey(unit)) ?? { current: unit.amount, before: null }

/** The lowest of the places as shown; null without one. */
export function lowestShown(
  units: readonly PayingUnit[],
  shown: ReadonlyMap<string, CardShown>
): CardShown | null {
  let lowest: CardShown | null = null
  for (const unit of units) {
    const price = shownOf(shown, unit)
    if (!lowest || price.current < lowest.current) {
      lowest = price
    }
  }
  return lowest
}

/** The price struck through beside a shown price, in the currency's amount; absent unless above it. */
export const struck = (shown: CardShown | null): { before?: number } =>
  shown && shown.before !== null && shown.before > shown.current
    ? { before: lira(shown.before) }
    : {}

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

/** The base prices of the rows read (`basePriceRows`): what each category sells at now. */
export const baseAmounts = (
  rows: ReadonlyMap<string, BasePrice | null>
): Map<string, Kurus | null> => new Map([...rows].map(([id, row]) => [id, row?.calculated ?? null]))

/**
 * How each place (one per category) is shown: its unit price less the
 * automatic promotions on its category, never below zero, and the price
 * before them struck through only by the price-before rule, read from the
 * category's recorded prices. A departure's difference has no record of
 * its own (a difference raised yesterday would make a price never sold
 * look cut, Ticari Reklam Yönetmeliği md. 14/3), so a place priced with
 * one is never struck through: its promoted price alone. Every place of
 * every departure asked in one reading of the record and the promotions,
 * whatever their number; by `placeKey`.
 */
export async function placeDisplays(
  container: Container,
  units: readonly PayingUnit[],
  bases: ReadonlyMap<string, BasePrice | null>,
  currencyCode: string,
  now: Date
): Promise<Map<string, CardShown>> {
  const priced = new Map<string, LinePrice>()
  const differs = new Set<string>()
  for (const unit of units) {
    const base = bases.get(unit.variant_id)
    if (!base) {
      continue
    }
    const key = placeKey(unit)
    if (unit.adjustment !== 0) {
      differs.add(key)
    }
    priced.set(key, {
      variant_id: unit.variant_id,
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
