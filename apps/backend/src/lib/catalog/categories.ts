export interface CategoryPlace {
  id: string
  /** Medusa's materialised path: its ancestors' ids and its own, dot-separated. */
  mpath?: string | null
}

const depth = (row: CategoryPlace): number => (row.mpath ?? "").split(".").length

/**
 * The most specific of a product's categories (docs/13 §2.2): the deepest,
 * the lowest id among equals so every reader picks the same one. What a
 * product without a chosen primary category is filed under.
 */
export function deepestCategory<T extends CategoryPlace>(
  categories: readonly (T | null | undefined)[]
): T | undefined {
  return categories
    .filter((row): row is T => Boolean(row))
    .sort((a, b) => depth(b) - depth(a) || a.id.localeCompare(b.id))[0]
}
