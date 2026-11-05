import type { MedusaContainer } from "@medusajs/framework/types"
import { chunksOf } from "../../lib/catalog"
import { fromMedusaAmount, kurus } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { priceDisplay } from "../../lib/pricing"
import type { PriceDisplay } from "../../lib/pricing"
import { pricesWithOffers } from "../../lib/pricing/offers"
import type { CartOffer } from "../../lib/pricing/offers"
import { PRICE_HISTORY_MODULE } from "../../modules/price-history"
import type PriceHistoryModuleService from "../../modules/price-history/service"
import { automaticOffers } from "./automatic-offers"
import { sellingPrices } from "./selling-prices"

// Variants priced per query
const VARIANT_CHUNK = 100

const toKurus = (amount: number | string) => fromMedusaAmount(amount, { allowRounding: true })

/** A variant's price as shown (the price-before rule's display), and a cart offer to name beside it. */
export interface ShownPrice extends PriceDisplay {
  /** An automatic promotion the cart applies once its condition is met (a minimum); null: none. */
  cart_offer: CartOffer | null
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
  const history = await container
    .resolve<PriceHistoryModuleService>(PRICE_HISTORY_MODULE)
    .historyOf(ids, currency)
  const displays = new Map<string, ShownPrice>()
  for (const chunk of chunksOf(ids, VARIANT_CHUNK)) {
    const live = new Map<string, { amount: Kurus; original: Kurus }>()
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
    const offers = await automaticOffers(
      container,
      new Map([...live].map(([id, price]) => [id, price.amount])),
      currency
    )
    for (const [id, price] of live) {
      const points = (history.get(id) ?? []).map((row) => ({
        at: new Date(row.recorded_at),
        amount: toKurus(row.amount),
        original: toKurus(row.original_amount),
      }))
      const offer = offers.get(id)
      const paid = offer ? kurus(Math.max(0, price.amount - offer.discount)) : price.amount
      displays.set(id, {
        ...priceDisplay(
          pricesWithOffers(points, offer?.price ?? []),
          { amount: paid, original: price.original },
          now
        ),
        cart_offer: offer?.cart ?? null,
      })
    }
  }
  return displays
}
