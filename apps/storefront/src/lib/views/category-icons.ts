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
 * the section (an unknown one, from a newer backend, read as none), its own
 * picture (never a product's photo: the disc is small and quiet) and its
 * initial; its count while the shop shows counts. The tiles' cards ride
 * along for a theme without the drawing. No category: no section.
 */
export async function iconCategoriesView(
  section: StoreCategoriesSection & StoreCategoriesIcons,
  t: Translate
): Promise<HomeSectionView | null> {
  const [{ named }, counts] = await Promise.all([
    namedCategories(section.category_ids),
    section.show_count === true
      ? categoryCounts()
      : Promise.resolve(new Map<string, number>() as ReadonlyMap<string, number>),
  ])
  if (named.length === 0) {
    return null
  }
  const picked: Readonly<Record<string, unknown>> = section.category_icons
  const counted = (id: string) =>
    section.show_count === true ? { count: counts.get(id) ?? 0 } : {}
  const items = named.map(({ id, card }): CategoryIconView => ({
    label: card.label,
    path: card.path,
    icon: sectionIconOf(picked[id]),
    image: card.image ?? null,
    initial: initialOf(card.label),
    ...counted(id),
  }))
  const categories = named.map(({ id, card }): CategoryCardView => ({ ...card, ...counted(id) }))
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
