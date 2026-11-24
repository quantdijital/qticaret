import type { MedusaContainer } from "@medusajs/framework/types"
import { chunksOf } from "../../lib/catalog"
import { fromMedusaAmount, kurus } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { priceDisplay } from "../../lib/pricing"
import type { PriceDisplay } from "../../lib/pricing"
import { pricesWithOffers } from "../../lib/pricing/offers"
import type { CartOffer } from "../../lib/pricing/offers"
import { PRICE_HISTORY_MODULE } from "../../modules/price-history"
import type { PriceRecordRow } from "../../modules/price-history/service"
import type PriceHistoryModuleService from "../../modules/price-history/service"
import { automaticOffers } from "./automatic-offers"
import { sellingPrices } from "./selling-prices"

// Variants priced per query
const VARIANT_CHUNK = 100

type Resolver = Pick<MedusaContainer, "resolve">

const toKurus = (amount: number | string) => fromMedusaAmount(amount, { allowRounding: true })

/** A variant's price as shown (the price-before rule's display), and a cart offer to name beside it. */
export interface ShownPrice extends PriceDisplay {
  /** An automatic promotion the cart applies once its condition is met (a minimum); null: none. */
  cart_offer: CartOffer | null
}

/**
 * A unit's price before the automatic promotions, by variant: what it
 * sells at (`amount`) and its regular price (`original`). `recorded` says
 * what a recorded price of the variant comes to at this unit (a dated
 * departure's difference added, adr/0076 §4); left out, the record as it is.
 */
export interface UnitPrice {
  amount: Kurus
  original: Kurus
  recorded?: (price: Kurus) => Kurus
}

type History = ReadonlyMap<string, readonly PriceRecordRow[]>

const historyOf = (container: Resolver, ids: readonly string[], currency: string) =>
  container.resolve<PriceHistoryModuleService>(PRICE_HISTORY_MODULE).historyOf(ids, currency)

/** The displays of at most a chunk of units, their history already read. */
async function displaysOf(
  container: Resolver,
  units: ReadonlyMap<string, UnitPrice>,
  currency: string,
  history: History,
  now: Date
): Promise<Map<string, ShownPrice>> {
  const displays = new Map<string, ShownPrice>()
  const offers = await automaticOffers(
    container,
    new Map([...units].map(([id, unit]) => [id, unit.amount])),
    currency
  )
  for (const [id, unit] of units) {
    const at = unit.recorded ?? ((price: Kurus) => price)
    const points = (history.get(id) ?? []).map((row) => ({
      at: new Date(row.recorded_at),
      amount: at(toKurus(row.amount)),
      original: at(toKurus(row.original_amount)),
    }))
    const offer = offers.get(id)
    const paid = offer ? kurus(Math.max(0, unit.amount - offer.discount)) : unit.amount
    displays.set(id, {
      ...priceDisplay(
        pricesWithOffers(points, offer?.price ?? []),
        { amount: paid, original: unit.original },
        now
      ),
      cart_offer: offer?.cart ?? null,
    })
  }
  return displays
}

/**
 * How units at the prices given are shown in a currency: the automatic
 * promotions every shopper gets on each (Medusa's promotion module
 * decides which apply and takes them off the unit's own price, as the
 * cart will), struck through only by the price-before rule. The one
 * place a promotion becomes a shown price: `priceDisplays` reads every
 * variant's selling price through it, and a dated card its departure's
 * unit price (adr/0076 Ek "kart fiyatı promosyonlu").
 */
export async function unitDisplays(
  container: Resolver,
  units: ReadonlyMap<string, UnitPrice>,
  currency: string,
  now: Date = new Date()
): Promise<Map<string, ShownPrice>> {
  if (units.size === 0) {
    return new Map()
  }
  const history = await historyOf(container, [...units.keys()], currency)
  const displays = new Map<string, ShownPrice>()
  for (const chunk of chunksOf([...units], VARIANT_CHUNK)) {
    for (const entry of await displaysOf(container, new Map(chunk), currency, history, now)) {
      displays.set(...entry)
    }
  }
  return displays
}

/**
 * How each variant's price is shown in a currency (F4.3, ADR-0023): its
 * selling price now beside its recorded history, and the automatic
 * promotions every shopper gets on it (adr/0023 Ek 2026-11-05): those are
 * the price, from their start, so the card, the page and the cart agree.
 * One source for the storefront's price and the page's structured data. A
 * variant with no price in the currency has no display.
 */
export async function priceDisplays(
  container: MedusaContainer,
  variantIds: readonly string[],
  currency: string,
  now: Date = new Date()
): Promise<Map<string, ShownPrice>> {
  const ids = [...new Set(variantIds)]
  const history = await historyOf(container, ids, currency)
  const displays = new Map<string, ShownPrice>()
  for (const chunk of chunksOf(ids, VARIANT_CHUNK)) {
    const live = new Map<string, UnitPrice>()
    for (const variant of await sellingPrices(container, chunk, currency)) {
      const amount = variant.calculated_price?.calculated_amount
      if (amount === null || amount === undefined) {
        continue
      }
      live.set(variant.id, {
        amount: toKurus(amount),
        original: toKurus(variant.calculated_price?.original_amount ?? amount),
      })
    }
    for (const entry of await displaysOf(container, live, currency, history, now)) {
      displays.set(...entry)
    }
  }
  return displays
}
