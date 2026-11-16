import type { StoreCategoriesCollage, StoreCategoriesLinked, StoreCategory } from "@qticaret/types"
import type {
  CategoryCardView,
  CategoryCardsView,
  CategoryCollageView,
  LinkView,
  LinkedCategoryCardView,
  Translate,
} from "@qticaret/ui"
import { childrenOf } from "./categories"

/**
 * The category cards' `linked` variant (adr/0049 Ek 2026-11-15): each
 * named category (or each top one) a card with its first subcategories as
 * links. A subcategory is shown only with a live path (a hidden or
 * unpublished one has none) and, when the backend counted, with products;
 * a backend without counts gives none, and every live one is shown.
 */
export function linkedCards(
  named: readonly { id: string; card: CategoryCardView }[],
  all: readonly StoreCategory[],
  paths: Readonly<Record<string, string>>,
  counts: ReadonlyMap<string, number>,
  section: Pick<StoreCategoriesLinked, "links" | "image_position"> & { show_count?: boolean },
  t: Translate
): LinkedCategoryCardView[] {
  const counted = counts.size > 0
  return named.map(({ id, card }) => {
    const children = childrenOf(all, id).flatMap((child): LinkView[] => {
      const path = paths[child.id]
      if (!path || (counted && counts.get(child.id) === 0)) {
        return []
      }
      return [{ label: child.name, path }]
    })
    const shown = children.slice(0, section.links)
    const count = section.show_count === true ? counts.get(id) : undefined
    const { image, ...words } = card
    return {
      ...words,
      ...(section.image_position !== "none" && image ? { image } : {}),
      ...(count === undefined ? {} : { count }),
      children: shown,
      all: shown.length > 0 ? { label: t("categories.see_all"), path: card.path } : null,
    }
  })
}

/** The settings the theme lays the cards out by, with the cards. */
export const cardsView = (
  section: Pick<StoreCategoriesLinked, "columns" | "columns_mobile" | "image_position" | "frame">,
  cards: LinkedCategoryCardView[]
): CategoryCardsView => ({
  columns: section.columns,
  // Two on a phone only when the shop asks (bilesen-denetimi (b) 3); one, as before
  ...(section.columns_mobile === 2 ? { phoneColumns: 2 as const } : {}),
  imagePosition: section.image_position,
  frame: section.frame,
  cards,
})

/**
 * The collage's settings with its cards (adr/0049 Ek 2026-11-15); a card's
 * "see all" is not drawn there (the whole card links to the category).
 */
export const collageView = (
  section: Pick<StoreCategoriesCollage, "columns" | "columns_mobile" | "height" | "lead">,
  cards: LinkedCategoryCardView[]
): CategoryCollageView => ({
  columns: section.columns,
  ...(section.columns_mobile === 2 ? { phoneColumns: 2 as const } : {}),
  height: section.height,
  lead: section.lead === "on",
  cards,
})

/** Every named card's subcategories: their ids, for one paths request. */
export const childIds = (
  named: readonly { id: string }[],
  all: readonly StoreCategory[]
): string[] => named.flatMap(({ id }) => childrenOf(all, id).map((child) => child.id))
