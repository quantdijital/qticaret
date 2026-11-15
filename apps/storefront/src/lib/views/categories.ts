import type { CategoryCardView, CategoryTreeView, NavCategoryView } from "@qticaret/ui"
import type { StoreCategory, StoreImage } from "@qticaret/types"
import { categoryCard } from "./card-extras"

const byRank = (a: StoreCategory, b: StoreCategory) =>
  (a.rank ?? 0) - (b.rank ?? 0) || a.name.localeCompare(b.name, "tr")

/** A category's children, in the shop's order. */
export const childrenOf = (
  categories: readonly StoreCategory[],
  parentId: string | null
): StoreCategory[] =>
  categories.filter((category) => category.parent_category_id === parentId).sort(byRank)

/** The category and every category below it: a listing shows the whole subtree. */
export function subtreeIds(categories: readonly StoreCategory[], rootId: string): string[] {
  const ids = [rootId]
  // The iterator also visits the ids pushed while it runs: breadth first
  for (const id of ids) {
    for (const child of childrenOf(categories, id)) {
      ids.push(child.id)
    }
  }
  return ids
}

/** Category pictures by id (adr/0046 Ek 2026-11-04); none: no pictures. */
type Pictures = ReadonlyMap<string, StoreImage>

const NO_PICTURES: Pictures = new Map()

/** The menu: top categories and their children, with their pictures, those with a live path only. */
export function navigation(
  categories: readonly StoreCategory[],
  paths: Record<string, string>,
  pictures: Pictures = NO_PICTURES
): NavCategoryView[] {
  return childrenOf(categories, null).flatMap((top) => {
    const path = paths[top.id]
    if (!path) {
      return []
    }
    const children = childrenOf(categories, top.id).flatMap((child): CategoryCardView[] => {
      const childPath = paths[child.id]
      return childPath
        ? [categoryCard({ label: child.name, path: childPath }, pictures.get(child.id))]
        : []
    })
    return [{ ...categoryCard({ label: top.name, path }, pictures.get(top.id)), children }]
  })
}

/**
 * The tree's entries without a picture of their own given the one the
 * menu already shows for the same page (its newest product's photo,
 * `withNavPictures`): the catalog header's "Kategoriler" list draws the
 * dropdowns' squares with no request of its own. An entry the menu does
 * not hold keeps what it has.
 */
export function withPicturesOf(
  tree: readonly NavCategoryView[],
  menu: readonly NavCategoryView[]
): NavCategoryView[] {
  const shown = new Map(
    menu
      .flatMap((entry) => [entry, ...entry.children])
      .flatMap((entry) => (entry.image ? [[entry.path, entry.image] as const] : []))
  )
  const pictured = <E extends CategoryCardView>(entry: E): E => {
    const image = entry.image ? undefined : shown.get(entry.path)
    return image ? { ...entry, image } : entry
  }
  return tree.map((entry) => ({ ...pictured(entry), children: entry.children.map(pictured) }))
}

// The index shows the tree this deep; deeper categories are on their parents' pages
const TREE_DEPTH = 4

/**
 * Every category as a tree (`/kategoriler`): the top ones with the ones
 * below them, in the shop's order. A category without a live path is left
 * out with what is below it, as the menu does.
 */
export function categoryTree(
  categories: readonly StoreCategory[],
  paths: Record<string, string>,
  pictures: Pictures = NO_PICTURES
): CategoryTreeView[] {
  const below = (parentId: string | null, depth: number): CategoryTreeView[] =>
    depth > TREE_DEPTH
      ? []
      : childrenOf(categories, parentId).flatMap((category) => {
          const path = paths[category.id]
          return path
            ? [
                {
                  ...categoryCard({ label: category.name, path }, pictures.get(category.id)),
                  children: below(category.id, depth + 1),
                },
              ]
            : []
        })
  return below(null, 1)
}
