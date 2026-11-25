import "server-only"
import type { StoreCategoriesIcons, StoreCategoriesSection } from "@qticaret/types"
import { categoryIconsSettingsOf } from "@qticaret/types/section-categories"
import { sectionIconOf } from "@qticaret/types/section-icons"
import type { CategoryCardView, CategoryIconView, HomeSectionView, Translate } from "@qticaret/ui"
import { categoryCounts } from "@/lib/store-api/extras"
import { layoutLink } from "./layout"
import { namedCategories } from "./section-data"

/** A name's first letter as a disc shows it, upper-cased the Turkish way ("i" → "İ"). */
export const initialOf = (name: string): string =>
  (Array.from(name.trim())[0] ?? "").toLocaleUpperCase("tr-TR")

/**
 * The categories' icon row (adr/0077 §10 Ek): the categories the section
 * names (else the top ones), each with the icon the shop picked for it in
 * the section by its id, else by its handle (a preset's; an unknown one,
 * from a newer backend, read as none), its own
 * picture (never a product's photo: the disc is small and quiet) and its
 * initial; its count while the shop shows counts. The tiles' cards ride
 * along for a theme without the drawing. No category: no section.
 */
export async function iconCategoriesView(
  section: StoreCategoriesSection & StoreCategoriesIcons,
  t: Translate
): Promise<HomeSectionView | null> {
  const [{ categories: all, named }, counts] = await Promise.all([
    namedCategories(section.category_ids),
    section.show_count === true
      ? categoryCounts()
      : Promise.resolve(new Map<string, number>() as ReadonlyMap<string, number>),
  ])
  // A preset's handles narrow the top ones, in its order, while no id is named
  const handled = section.category_handles ?? []
  const byHandleOrder =
    section.category_ids.length === 0 && handled.length > 0
      ? handled.flatMap((handle) => {
          const found = all.find((category) => category.handle === handle)
          const entry = found ? named.find((each) => each.id === found.id) : undefined
          return entry ? [entry] : []
        })
      : null
  const shown = byHandleOrder && byHandleOrder.length > 0 ? byHandleOrder : named
  if (shown.length === 0) {
    return null
  }
  const picked: Readonly<Record<string, unknown>> = section.category_icons
  // A preset's icons by handle: read only where no id's icon is (id > handle > picture > initial)
  const byHandle: Readonly<Record<string, unknown>> = section.category_icons_by_handle ?? {}
  const handles = new Map(all.map((category) => [category.id, category.handle]))
  const iconOf = (id: string) => {
    const handle = handles.get(id)
    return (
      sectionIconOf(picked[id]) ??
      (handle !== undefined && Object.hasOwn(byHandle, handle)
        ? sectionIconOf(byHandle[handle])
        : null)
    )
  }
  const counted = (id: string) =>
    section.show_count === true ? { count: counts.get(id) ?? 0 } : {}
  const items = shown.map(({ id, card }): CategoryIconView => ({
    label: card.label,
    path: card.path,
    icon: iconOf(id),
    image: card.image ?? null,
    initial: initialOf(card.label),
    ...counted(id),
  }))
  const categories = shown.map(({ id, card }): CategoryCardView => ({ ...card, ...counted(id) }))
  const more = layoutLink(section.more ?? null, t)
  return {
    id: section.id,
    type: "categories",
    title: section.title ?? t("home.shop_categories"),
    categories,
    ...(more ? { more } : {}),
    variant: "icons",
    icons: { ...categoryIconsSettingsOf(section), items },
  }
}
