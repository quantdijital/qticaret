import "server-only"
import type { StoreProductSection } from "@qticaret/types"
import { scrollerSettingsOf } from "@qticaret/types/section-scroller"
import { variantOf } from "@qticaret/types/section-variants"
import { CARD_VARIANTS } from "@qticaret/ui"
import type { HomeSectionView, Translate } from "@qticaret/ui"
import { isStoreApiError } from "@/lib/store-api/errors"
import { type ProductContext, railCards, relatedProducts } from "./section-data"

type Related = Extract<StoreProductSection, { type: "related_products" }>

/**
 * A related rail under a product, drawn as a product rail (bilesen-denetimi
 * (b) 7): a grid with the shop's cards in a row (and on a phone), or one
 * row that slides with the scroller kit; its own card variant over the
 * theme setting's. None when its source has nothing else or cannot be read.
 */
export async function relatedView(
  section: Related,
  t: Translate,
  product: ProductContext | undefined
): Promise<HomeSectionView | null> {
  if (!product) {
    return null
  }
  try {
    const products = await relatedProducts(section.source, section.limit, product)
    // One off this build's list (a newer backend's) is the theme setting's
    const card = CARD_VARIANTS.find((each) => each === section.card_variant) ?? null
    const cards = await railCards(products, card)
    if (cards.length === 0) {
      return null
    }
    const variant = variantOf("related_products", section.variant)
    return {
      id: section.id,
      type: "products",
      title: section.title ?? t(product.unshipped ? "product.related_plain" : "product.related"),
      products: cards,
      more: null,
      empty: "",
      ...(variant === "carousel"
        ? { variant, scroller: scrollerSettingsOf(section.scroller) }
        : {
            columns: section.columns ?? 3,
            ...(section.columns_mobile === 1 ? { phoneColumns: 1 as const } : {}),
          }),
    }
  } catch (error) {
    // A rail the backend could not answer is left out, not the product page
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}
