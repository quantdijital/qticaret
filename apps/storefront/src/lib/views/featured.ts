import "server-only"
import type { StoreFeaturedProductSection } from "@qticaret/types"
import type { FeaturedProductSectionView, Translate } from "@qticaret/ui"
import { cardFacts } from "@/lib/store-api/extras"
import { isStoreApiError } from "@/lib/store-api/errors"
import { pathsOf, priceDisplays, productById } from "@/lib/store-api/requests"
import { withCardFacts } from "./card-extras"
import { productImages } from "./image"
import { productCard, variantIdsOf } from "./product"
import { specGroupsOf, specsOf } from "./specs"
import { cardOptions } from "./theme-settings"

/**
 * One product up close on the home page (adr/0046 Ek 2026-11-05): the
 * product as its page reads it (pictures, headline facts, spec table in
 * its template's sections) and as a card sells it (path, the shopper's
 * price, stock, quick add). Left out when the product has no live page or
 * the backend cannot answer: the home page is not the product's to break.
 */
export async function featuredView(
  section: StoreFeaturedProductSection,
  t: Translate
): Promise<FeaturedProductSectionView | null> {
  try {
    const product = await productById(section.product_id)
    const [paths, displays, options, facts] = await Promise.all([
      pathsOf("product", [product.id]),
      priceDisplays(variantIdsOf([product])),
      cardOptions(),
      cardFacts([product.id]),
    ])
    const path = paths[product.id]
    if (!path) {
      return null
    }
    const [card] = withCardFacts([productCard(product, path, displays, options)], facts, options, t)
    if (!card) {
      return null
    }
    return {
      id: section.id,
      type: "featured_product",
      title: section.title,
      text: section.text,
      product: card,
      subtitle: product.subtitle ?? null,
      images: productImages(product),
      facts: specsOf(product.attribute_values, t).filter((spec) => spec.highlight),
      specGroups: specGroupsOf(product.attribute_values, t),
    }
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}
