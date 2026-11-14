import type { ProductSource } from "@/features/storefront/api/layout"
import { BEST_SELLER_DAYS } from "@/features/storefront/api/layout"

// Where a product rail's lists take their products from (adr/0049 Ek 2026-11-05, Ek 2026-11-15)

export type SourceKind = ProductSource["kind"]

export const SOURCE_KINDS: readonly SourceKind[] = [
  "newest",
  "best_sellers",
  "on_sale",
  "category",
  "collection",
  "manual",
]

/** The sources whose name is a list's title until the shop writes its own. */
export const NAMED: readonly SourceKind[] = ["best_sellers", "on_sale"]

/** A source of another kind, nothing chosen in it yet. */
export function sourceOf(kind: SourceKind): ProductSource {
  switch (kind) {
    case "newest":
    case "on_sale":
      return { kind }
    case "best_sellers":
      return { kind, days: BEST_SELLER_DAYS.default }
    case "category":
      return { kind, category_id: "" }
    case "collection":
      return { kind, collection_id: "" }
    case "manual":
      return { kind, product_ids: [] }
  }
}
