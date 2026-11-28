import "server-only"
import type { MiniCartView, Translate } from "@qticaret/ui"
import type { StoreProduct } from "@qticaret/types"
import type { Cart } from "@/lib/cart/cart"
import { isPaymentLinkCart } from "@/lib/cart/payment-link"
import { isStoreApiError } from "@/lib/store-api/errors"
import { linkedProductIds } from "@/lib/store-api/extras"
import { productsInOrder, railCards } from "./section-data"

/** The drawer's few suggestions under its lines. */
export const DRAWER_SUGGESTIONS = 3

/**
 * What the cart's products are bought with (S3, the shop's "Birlikte
 * alınanlar"), in the cart's line order and the shop's order within each,
 * each once, none already in the cart: at most `limit`. The backend
 * answers only published products the shopper may buy, sold-out ones left
 * out while the shop hides them from its listings. None without links.
 */
export async function crossSellProducts(
  productIds: readonly string[],
  limit: number
): Promise<StoreProduct[]> {
  if (productIds.length === 0) {
    return []
  }
  const inCart = new Set(productIds)
  const ids = (await linkedProductIds("cross_sell", productIds)).filter((id) => !inCart.has(id))
  return ids.length === 0 ? [] : productsInOrder(ids.slice(0, limit))
}

/** The drawer with its suggestions; without them, as it was (no field at all). */
export const withSuggestions = (
  mini: MiniCartView | null,
  suggestions: MiniCartView["suggestions"]
): MiniCartView | null => (mini && suggestions ? { ...mini, suggestions } : mini)

/**
 * The header drawer's "Bunu da beğenebilirsiniz" (S3): a few of the
 * cart's cross-sells; none for a payment link's cart (its lines are
 * fixed), without links, or when the backend does not answer.
 */
export async function drawerSuggestions(
  cart: Cart | null,
  t: Translate
): Promise<MiniCartView["suggestions"]> {
  if (!cart || cart.items.length === 0 || isPaymentLinkCart(cart.metadata)) {
    return null
  }
  try {
    const products = await crossSellProducts(
      cart.items.flatMap((line) => line.product_id ?? []),
      DRAWER_SUGGESTIONS
    )
    return products.length === 0
      ? null
      : { title: t("cart.cross_sells"), products: await railCards(products) }
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}
