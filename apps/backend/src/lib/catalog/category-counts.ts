import { categoryAndBelow } from "./product-board"

export interface CountedCategory {
  id: string
  parent_category_id?: string | null
  products?: ({ id: string } | null)[] | null
}

/**
 * How many products each category's filter shows in the product list:
 * the products in it and in every category below it, each counted once
 * (a product in a parent and its child is one product). Drafts count, as
 * the list shows them.
 */
export function categoryProductCounts(
  categories: readonly CountedCategory[]
): Record<string, number> {
  const own = new Map(
    categories.map((category) => [
      category.id,
      (category.products ?? []).flatMap((product) => (product ? [product.id] : [])),
    ])
  )
  return Object.fromEntries(
    categories.map((category) => {
      const products = new Set<string>()
      for (const id of categoryAndBelow(category.id, categories)) {
        for (const product of own.get(id) ?? []) {
          products.add(product)
        }
      }
      return [category.id, products.size]
    })
  )
}
