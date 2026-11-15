import type { ProductSource } from "@/features/storefront/api/layout"
import { BEST_SELLER_DAYS, LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import type { Problem } from "./problems"
import { textProblem } from "./problems"

/** A rail's list's problems under `at`: its title, an empty choice in its source, its days. */
export function listProblems(
  at: string,
  list: { title: string | null; source: ProductSource }
): [string, Problem | null][] {
  const { source } = list
  return [
    [`${at}title`, textProblem(list.title, L.title)],
    [
      `${at}source`,
      source.kind === "manual" && source.product_ids.length === 0
        ? "productsRequired"
        : source.kind === "category" && source.category_id === ""
          ? "categoryRequired"
          : source.kind === "collection" && source.collection_id === ""
            ? "collectionRequired"
            : null,
    ],
    [
      `${at}days`,
      source.kind === "best_sellers" &&
      (source.days < BEST_SELLER_DAYS.min || source.days > BEST_SELLER_DAYS.max)
        ? "daysRange"
        : null,
    ],
  ]
}
