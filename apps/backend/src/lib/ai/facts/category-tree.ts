import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { FactsContainer } from "./types"

/**
 * Whether a category is one shoppers see, with its whole line of
 * ancestors (#250 D1): a sub-category under an internal or closed parent
 * has no page either, so its name never goes out. Kept apart from
 * `category.ts`, which reads a category page, so the listing and product
 * readers use it without an import cycle.
 */

export interface NamedCategory {
  name: string
  is_internal?: boolean | null
  is_active?: boolean | null
}

/** A category shoppers see now: neither internal nor closed. Its relatives are named only then. */
export const shownCategory = (
  category: NamedCategory | null | undefined
): category is NamedCategory =>
  !!category && category.is_internal !== true && category.is_active !== false

/** A category row as a tree walk reads it: its own flags and its parent's id. */
export interface TreeCategory extends NamedCategory {
  id: string
  parent_category_id?: string | null
}

// Deeper than any shop's tree: a longer walk is a loop, and the category is not shown
const MAX_CATEGORY_DEPTH = 32

/**
 * The category and its ancestors, nearest first, when every one of them
 * is shown (`shownCategory`); null when any is internal or closed, or an
 * ancestor is not among `byId` (unknown is not shown).
 */
export function shownLineage<T extends TreeCategory>(
  category: T,
  byId: ReadonlyMap<string, T>
): T[] | null {
  const lineage: T[] = []
  let current: T | undefined = category
  while (current) {
    if (!shownCategory(current) || lineage.length >= MAX_CATEGORY_DEPTH) {
      return null
    }
    lineage.push(current)
    const parentId: string | null | undefined = current.parent_category_id
    if (!parentId) {
      return lineage
    }
    current = byId.get(parentId)
  }
  return null
}

/** A category as a product's link reads it: its id and Medusa's path (ancestors' ids, then its own). */
export interface PlacedCategory extends NamedCategory {
  id?: string | null
  mpath?: string | null
}

/** The fields a product's categories are read with, for `shownCategoryIds`. */
export const PLACED_CATEGORY_FIELDS = [
  "categories.id",
  "categories.mpath",
  "categories.name",
  "categories.is_internal",
  "categories.is_active",
] as const

/** Only flags and the tree's links: names are taken from the product's own rows. */
export const CATEGORY_TREE_FIELDS = [
  "id",
  "is_internal",
  "is_active",
  "parent_category_id",
] as const

/** The most categories and ancestors one check reads; past it the rest count as not shown. */
export const MAX_TREE_IDS = 1_000

/**
 * The ids among these categories shoppers see with every ancestor, read
 * in one query of the categories and their ancestors (by Medusa's path).
 * A category whose own flags already hide it is not looked up.
 */
export async function shownCategoryIds(
  container: FactsContainer,
  categories: readonly (PlacedCategory | null | undefined)[]
): Promise<Set<string>> {
  const candidates = categories.filter(
    (category): category is PlacedCategory & { id: string } =>
      shownCategory(category) && typeof category.id === "string"
  )
  if (candidates.length === 0) {
    return new Set()
  }
  const ids = new Set<string>()
  for (const category of candidates) {
    for (const id of [...(category.mpath ?? "").split("."), category.id]) {
      if (id !== "") {
        ids.add(id)
      }
    }
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_category",
    fields: [...CATEGORY_TREE_FIELDS],
    filters: { id: [...ids].slice(0, MAX_TREE_IDS) },
  })
  const byId = new Map(
    (data as Omit<TreeCategory, "name">[]).map((row) => [row.id, { ...row, name: "" }])
  )
  const shown = new Set<string>()
  for (const category of candidates) {
    const row = byId.get(category.id)
    if (row && shownLineage(row, byId)) {
      shown.add(category.id)
    }
  }
  return shown
}
