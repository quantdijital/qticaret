import type { MedusaContainer } from "@medusajs/framework/types"
import { chunksOf } from "../../lib/catalog"
import { fromMedusaAmount, kurus } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { priceDisplay } from "../../lib/pricing"
import type { PriceDisplay } from "../../lib/pricing"
import { pricesWithOffers } from "../../lib/pricing/offers"
import type { CartOffer, Offer } from "../../lib/pricing/offers"
import { PRICE_HISTORY_MODULE } from "../../modules/price-history"
import type { PriceRecordRow } from "../../modules/price-history/service"
import type PriceHistoryModuleService from "../../modules/price-history/service"
import { automaticOffers, shownOffers } from "./automatic-offers"
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

/** A unit's price before the automatic promotions, by variant: what it sells at and its regular price. */
export interface UnitPrice {
  amount: Kurus
  original: Kurus
}

/**
 * A unit priced apart from its variant's other units (a departure's place,
 * its difference added): the variant whose recorded prices and promotions
 * it takes, and its prices.
 */
export interface LinePrice extends UnitPrice {
  variant_id: string
}

/** What every part of one pricing shares: its history, and its promotions read once (at the first part that has a price). */
interface Pricing {
  container: Resolver
  currency: string
  history: ReadonlyMap<string, readonly PriceRecordRow[]>
  offers: () => Promise<ReadonlyMap<string, Offer>>
  now: Date
}

async function pricingFor(
  container: Resolver,
  ids: readonly string[],
  currency: string,
  now: Date
): Promise<Pricing> {
  const history = await container
    .resolve<PriceHistoryModuleService>(PRICE_HISTORY_MODULE)
    .historyOf(ids, currency)
  let offers: Promise<ReadonlyMap<string, Offer>> | undefined
  return {
    container,
    currency,
    history,
    offers: () => (offers ??= shownOffers(container, currency)),
    now,
  }
}

/** The displays of at most a chunk of units. */
async function displaysOf(
  pricing: Pricing,
  units: ReadonlyMap<string, LinePrice>
): Promise<Map<string, ShownPrice>> {
  const displays = new Map<string, ShownPrice>()
  const offers = await automaticOffers(pricing.container, units, pricing.currency, pricing.offers)
  for (const [id, unit] of units) {
    const points = (pricing.history.get(unit.variant_id) ?? []).map((row) => ({
      at: new Date(row.recorded_at),
      amount: toKurus(row.amount),
      original: toKurus(row.original_amount),
    }))
    const offer = offers.get(id)
    const paid = offer ? kurus(Math.max(0, unit.amount - offer.discount)) : unit.amount
    displays.set(id, {
      ...priceDisplay(
        pricesWithOffers(points, offer?.price ?? []),
        { amount: paid, original: unit.original },
        pricing.now
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
 * cart will), struck through only by the price-before rule over the
 * variant's recorded prices. The one place a promotion becomes a shown
 * price: `priceDisplays` reads every variant's selling price through it,
 * and a dated product its departures' places (adr/0076 Ek "kart fiyatı
 * promosyonlu", "kalkış fiyatı promosyonlu"): one variant at several
 * prices, each under its own key. The record and the promotions are read
 * once for all of them.
 */
export async function unitDisplays(
  container: Resolver,
  units: ReadonlyMap<string, LinePrice>,
  currency: string,
  now: Date = new Date()
): Promise<Map<string, ShownPrice>> {
  if (units.size === 0) {
    return new Map()
  }
  const variants = [...new Set([...units.values()].map((unit) => unit.variant_id))]
  const pricing = await pricingFor(container, variants, currency, now)
  const displays = new Map<string, ShownPrice>()
  for (const chunk of chunksOf([...units], VARIANT_CHUNK)) {
    for (const entry of await displaysOf(pricing, new Map(chunk))) {
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
  const pricing = await pricingFor(container, ids, currency, now)
  const displays = new Map<string, ShownPrice>()
  for (const chunk of chunksOf(ids, VARIANT_CHUNK)) {
    const live = new Map<string, LinePrice>()
    for (const variant of await sellingPrices(container, chunk, currency)) {
      const amount = variant.calculated_price?.calculated_amount
      if (amount === null || amount === undefined) {
        continue
      }
      live.set(variant.id, {
        variant_id: variant.id,
        amount: toKurus(amount),
        original: toKurus(variant.calculated_price?.original_amount ?? amount),
      })
    }
    for (const entry of await displaysOf(pricing, live)) {
      displays.set(...entry)
    }
  }
  return displays
}
