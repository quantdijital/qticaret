import { useQuery } from "@tanstack/react-query"
import { shopDefaultsQuery } from "@/features/products/api/lookups"
import { priceHistoryQuery } from "@/features/products/api/price-history"
import type { PriceDisplayView } from "@/features/products/api/price-history"
import { productCatalogQuery } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { useFeature } from "@/features/settings/api/features"
import type { CatalogVariant } from "./variant-codes"
import type { Variant } from "./variant-values"

/** What the variants' rows and dialog read besides the product: the shop's stock place, costs, discounts. */
export function useVariantContext(product: ProductDetail) {
  const defaults = useQuery(shopDefaultsQuery())
  // Unit costs and MPNs are the catalog's (F11.4); an edit starts from them
  const catalog = useQuery(productCatalogQuery(product.id))
  const history = useQuery(priceHistoryQuery(product.id, "try"))
  const variants: Variant[] = [...(product.variants ?? [])].sort(
    (a, b) => (a.variant_rank ?? 0) - (b.variant_rank ?? 0)
  )
  // Selling past stock needs the preorder flag; a variant already on can still be turned off
  const preorderOn = useFeature("stock.preorder")
  return {
    variants,
    locationId: defaults.data?.locationId ?? null,
    catalog: new Map<string, CatalogVariant>(
      (catalog.data?.variants ?? []).map((row) => [row.id, row])
    ),
    displays: new Map<string, PriceDisplayView | null>(
      (history.data?.variants ?? []).map((row) => [row.id, row.display])
    ),
    ready: defaults.isSuccess && catalog.isSuccess,
    preorderOn,
    preorder: preorderOn || variants.some((variant) => variant.allow_backorder),
  }
}
