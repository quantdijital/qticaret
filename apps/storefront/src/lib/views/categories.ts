import type { LinkView, NavCategoryView } from "@qticaret/ui"
import type { StoreCategory } from "@qticaret/types"

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

/** The menu: top categories and their children, those with a live path only. */
export function navigation(
  categories: readonly StoreCategory[],
  paths: Record<string, string>
): NavCategoryView[] {
  return childrenOf(categories, null).flatMap((top) => {
    const path = paths[top.id]
    if (!path) {
      return []
    }
    const children = childrenOf(categories, top.id).flatMap((child): LinkView[] => {
      const childPath = paths[child.id]
      return childPath ? [{ label: child.name, path: childPath }] : []
    })
    return [{ label: top.name, path, children }]
  })
}
