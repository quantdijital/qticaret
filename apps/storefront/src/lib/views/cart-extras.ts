import "server-only"
import type { CartPageView, Translate } from "@qticaret/ui"
import type { StoreProduct } from "@qticaret/types"
import type { Cart } from "@/lib/cart/cart"
import { cartShippingEstimate } from "@/lib/cart/shipping-estimate"
import { isStoreApiError } from "@/lib/store-api/errors"
import { listProducts, priceDisplays, storefrontLayout } from "@/lib/store-api/requests"
import type { PriceDisplay } from "@qticaret/types"
import { cartOfferText } from "./price"
import { railCards } from "./section-data"
import { shippingEstimateText } from "./shipping-estimate"
import { isWholesaleDisplays } from "./wholesale-displays"

/**
 * What the cart page shows beside its lines (adr/0046 Ek 2026-11-05):
 * shipping before an address (the shop's main option as the backend
 * prices it, `shippingEstimateText`), the shop's cart offers and products
 * to add.
 * Each is the backend's, priced there; a call that fails leaves its part out.
 */

/** Products the cart offers to add: a row of four on a desktop. */
export const UPSELL_COUNT = 4

/**
 * The shop's cart offers on the cart's variants, in words, each once; none
 * for a wholesaler (ADR-0068 §6: automatic campaigns are not theirs).
 */
export function offersOf(displays: Record<string, PriceDisplay>, t: Translate): string[] {
  if (isWholesaleDisplays(displays)) {
    return []
  }
  const said = Object.values(displays).flatMap((display) => {
    const text = cartOfferText(display.cart_offer, t)
    return text ? [text] : []
  })
  return [...new Set(said)]
}

/** Products not already in the cart, in the order given, at most `limit`. */
export const notInCart = (
  products: readonly StoreProduct[],
  inCart: ReadonlySet<string>,
  limit: number
): StoreProduct[] => products.filter((product) => !inCart.has(product.id)).slice(0, limit)

/** Null for a Store API refusal; anything else is a fault and is thrown. */
const quiet = <T>(promise: Promise<T>): Promise<T | null> =>
  promise.catch((error: unknown) => {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  })

/** The shop's best sellers from its home design, else its newest products. */
async function upsellSource(t: Translate): Promise<{ title: string; products: StoreProduct[] }> {
  const layout = await quiet(storefrontLayout())
  const best = layout?.home.find(
    (section) => section.type === "products" && section.source.kind === "best_sellers"
  )
  const ids = best?.type === "products" ? (best.product_ids ?? []) : []
  if (ids.length > 0) {
    const { products } = await listProducts({ limit: ids.length, ids })
    const byId = new Map(products.map((product) => [product.id, product]))
    return {
      title: t("home.best_sellers"),
      products: ids.flatMap((id) => byId.get(id) ?? []),
    }
  }
  const { products } = await listProducts({ limit: 12, order: "-created_at" })
  return { title: t("home.products"), products }
}

async function upsellOf(cart: Cart | null, t: Translate): Promise<CartPageView["upsell"]> {
  const source = await upsellSource(t)
  const inCart = new Set((cart?.items ?? []).flatMap((line) => line.product_id ?? []))
  const products = notInCart(source.products, inCart, UPSELL_COUNT)
  if (products.length === 0) {
    return null
  }
  return { title: source.title, products: await railCards(products) }
}

/**
 * The cart page's extras; an empty cart (or none) gets only the products
 * to start with. Each part is null or empty when its call fails.
 */
export async function cartExtras(
  cart: Cart | null,
  t: Translate
): Promise<Pick<CartPageView, "shipping" | "offers" | "upsell">> {
  const full = cart !== null && cart.items.length > 0
  const variants = (cart?.items ?? []).flatMap((line) => line.variant_id ?? [])
  const [estimate, displays, upsell] = await Promise.all([
    full ? cartShippingEstimate(cart.id) : null,
    variants.length > 0 ? quiet(priceDisplays(variants)) : null,
    quiet(upsellOf(cart, t)),
  ])
  return {
    shipping: shippingEstimateText(estimate, t),
    offers: displays ? offersOf(displays, t) : [],
    upsell: upsell ?? null,
  }
}
