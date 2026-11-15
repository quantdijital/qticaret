import "server-only"
import type { PriceDisplay } from "@qticaret/types"
import { storeGet } from "./server"

/** The wholesaler's own prices route (ADR-0068 §7): personal, never in the shared cache. */
export const WHOLESALE_PRICES_PATH = "/store/customers/me/wholesale-prices"

interface WholesalePricesAnswer {
  wholesale_prices: Record<string, { net: string; gross: string; vat_rate: number }>
}

/**
 * A wholesaler's price as the storefront shows it (ADR-0068 §5–§6): one
 * price, without KDV, the KDV-included amount beside it for what follows
 * the paid price; never struck through, no 30-day note, no cart offer.
 */
export function wholesaleDisplay(price: { net: string; gross: string }): PriceDisplay {
  return {
    current: price.net,
    regular: price.net,
    before: null,
    on_sale: false,
    since: null,
    basis: null,
    rule_version: "wholesale",
    cart_offer: null,
    vat_exclusive: true,
    gross: price.gross,
  }
}

/**
 * The signed-in wholesaler's prices by variant, a hundred at a time:
 * always with the session's key (`storeGet`, Next's fetch cache off),
 * never through `storePublicGet` or `shared.ts`, so no other shopper's
 * page can be handed them.
 */
export async function wholesaleDisplays(
  variantIds: readonly string[]
): Promise<Record<string, PriceDisplay>> {
  const found: Record<string, PriceDisplay> = {}
  for (let start = 0; start < variantIds.length; start += 100) {
    const { wholesale_prices } = await storeGet<WholesalePricesAnswer>(WHOLESALE_PRICES_PATH, {
      variant_id: variantIds.slice(start, start + 100),
    })
    for (const [id, price] of Object.entries(wholesale_prices)) {
      found[id] = wholesaleDisplay(price)
    }
  }
  return found
}
