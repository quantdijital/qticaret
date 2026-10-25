import type { Category } from "./api/categories"

/**
 * The category tree as the page shows it: rows in rank order with their
 * depth, each category's descendants (a parent cannot move under them) and
 * its storefront path (docs/13 §2: ancestors' handles, then its own).
 */

export interface TreeRow {
  category: Category
  depth: number
  hasChildren: boolean
}

const byRank = (a: Category, b: Category) =>
  (a.rank ?? 0) - (b.rank ?? 0) || a.name.localeCompare(b.name, "tr")

export function childrenOf(categories: Category[]): Map<string | null, Category[]> {
  const children = new Map<string | null, Category[]>()
  for (const category of categories) {
    const parent = category.parent_category_id ?? null
    children.set(parent, [...(children.get(parent) ?? []), category])
  }
  for (const list of children.values()) {
    list.sort(byRank)
  }
  return children
}

/** Rows to draw; a collapsed category hides its subtree. */
export function treeRows(categories: Category[], collapsed: ReadonlySet<string>): TreeRow[] {
  const children = childrenOf(categories)
  const walk = (parent: string | null, depth: number): TreeRow[] =>
    (children.get(parent) ?? []).flatMap((category) => {
      const kids = children.get(category.id) ?? []
      const row = { category, depth, hasChildren: kids.length > 0 }
      return collapsed.has(category.id) ? [row] : [row, ...walk(category.id, depth + 1)]
    })
  return walk(null, 0)
}

export function descendantsOf(categories: Category[], id: string): Set<string> {
  const children = childrenOf(categories)
  const found = new Set<string>()
  const visit = (parent: string) => {
    for (const child of children.get(parent) ?? []) {
      if (!found.has(child.id)) {
        found.add(child.id)
        visit(child.id)
      }
    }
  }
  visit(id)
  return found
}

/** Handles from the root down to `parentId`, for the path preview. */
export function ancestorHandles(categories: Category[], parentId: string | null): string[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const handles: string[] = []
  const seen = new Set<string>()
  let current = parentId ? byId.get(parentId) : undefined
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    handles.unshift(current.handle)
    current = current.parent_category_id ? byId.get(current.parent_category_id) : undefined
  }
  return handles
}

/** The sibling to swap with when moving up (-1) or down (+1); undefined at the ends. */
export function siblingFor(
  categories: Category[],
  category: Category,
  step: -1 | 1
): Category | undefined {
  const siblings = childrenOf(categories).get(category.parent_category_id ?? null) ?? []
  return siblings[siblings.findIndex((item) => item.id === category.id) + step]
}
