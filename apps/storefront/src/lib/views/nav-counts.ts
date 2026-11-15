import type { CategoryCardView, NavCategoryView } from "@qticaret/ui"

/**
 * The menu's entries with their product counts (`/store/category-counts`,
 * adr/0049 Ek 2026-11-14 §10 karar 7b: a category's products and its
 * shown subcategories'): the header's dropdown and the phone's sheet show
 * them beside each row. Only a category's page with one product or more
 * gets one; an entry that is no category's page, a count of 0, or a
 * backend that did not answer (an empty map) leaves the row without a
 * badge, never a wrong number. Every entry stays, counted or not: the
 * menu hides no category for its count.
 */
export function withNavCounts(
  menu: readonly NavCategoryView[],
  paths: Readonly<Record<string, string>>,
  counts: ReadonlyMap<string, number>
): NavCategoryView[] {
  const idByPath = new Map(Object.entries(paths).map(([id, path]) => [path, id]))
  const counted = <E extends CategoryCardView>(entry: E): E => {
    const id = idByPath.get(entry.path)
    const count = id === undefined ? undefined : counts.get(id)
    return typeof count === "number" && Number.isSafeInteger(count) && count > 0
      ? { ...entry, count }
      : entry
  }
  return menu.map((entry) => ({ ...counted(entry), children: entry.children.map(counted) }))
}
