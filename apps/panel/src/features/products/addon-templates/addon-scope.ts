/** A new add-on's "Kapsam" on the product page (2026-11-23). */

/** Where a new add-on goes: the product's own list, or a new template applied to products. */
export interface AddonScope {
  mode: "product" | "template"
  /** With `template`: every product, this product's category (and those below it), or this one. */
  target: "all" | "category" | "product"
  /** The template's name; empty, the add-on's own. */
  name: string
}

export const DEFAULT_SCOPE: AddonScope = { mode: "product", target: "all", name: "" }

/** A category a new add-on's template may be applied to, with those below it. */
export interface ScopeCategory {
  id: string
  name: string
}

/** "Bu ürünün kategorisindeki ürünler": the product's primary category, else its first. */
export const scopeCategoryOf = (catalog: {
  primary_category_id: string | null
  categories: ScopeCategory[]
}): ScopeCategory | null =>
  catalog.categories.find((each) => each.id === catalog.primary_category_id) ??
  catalog.categories[0] ??
  null
