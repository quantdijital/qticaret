import type { CategoryOption } from "@/features/products/api/lookups"

/** Categories in tree order, each with its depth for indenting. */
export function treeOrder(
  categories: CategoryOption[]
): { category: CategoryOption; depth: number }[] {
  const children = new Map<string | null, CategoryOption[]>()
  for (const category of categories) {
    const parent = category.parent_category_id ?? null
    children.set(parent, [...(children.get(parent) ?? []), category])
  }
  const walk = (
    parent: string | null,
    depth: number
  ): { category: CategoryOption; depth: number }[] =>
    (children.get(parent) ?? [])
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.name.localeCompare(b.name, "tr"))
      .flatMap((category) => [{ category, depth }, ...walk(category.id, depth + 1)])
  return walk(null, 0)
}
