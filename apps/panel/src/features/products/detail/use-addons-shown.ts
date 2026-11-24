import { useQuery } from "@tanstack/react-query"
import { ADDONS_FLAG } from "@/features/products/api/addons"
import { productCatalogQuery } from "@/features/products/api/product-edit"
import { featuresQuery, useFeatureState } from "@/features/settings/api/features"

/**
 * Whether the product's page shows its add-ons: while the shop's add-ons
 * are on, or while this product still has some (its own or a template's); undefined until both are
 * known (a tab that appears and goes would shift the page).
 */
export function useAddonsShown(productId: string): boolean | undefined {
  const catalog = useQuery(productCatalogQuery(productId))
  const features = useQuery(featuresQuery())
  const state = useFeatureState(ADDONS_FLAG)
  // Unreadable flags read as off: the product's own add-ons still show
  const flagOn = features.isError ? false : state
  if (!catalog.data || flagOn === undefined) {
    return undefined
  }
  return flagOn || catalog.data.addons.length > 0 || (catalog.data.addon_templates ?? []).length > 0
}
