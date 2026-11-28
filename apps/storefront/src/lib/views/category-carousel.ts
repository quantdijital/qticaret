import "server-only"
import type {
  StoreCategoriesCarousel,
  StoreCategoriesSection,
  StoreCategory,
} from "@qticaret/types"
import { scrollerSettingsOf } from "@qticaret/types/section-scroller"
import type { HomeSectionView, Translate } from "@qticaret/ui"
import { allCategories } from "@/lib/store-api/requests"
import { withCounts } from "./catalog"
import { picturedCategories } from "./category-tiles"
import { layoutLink } from "./layout"
import { namedCategories } from "./section-data"

/**
 * The ids the sliding cards show: the ones the section names; else, while
 * a preset wrote handles, those found among the shop's categories in the
 * preset's order; else none (the top ones). A handle the shop lacks is
 * skipped; none found reads as none written.
 */
export function carouselIds(
  section: Pick<StoreCategoriesSection, "category_ids"> &
    Pick<StoreCategoriesCarousel, "category_handles">,
  categories: readonly Pick<StoreCategory, "id" | "handle">[]
): string[] {
  if (section.category_ids.length > 0) {
    return [...section.category_ids]
  }
  return (section.category_handles ?? []).flatMap(
    (handle) => categories.find((category) => category.handle === handle)?.id ?? []
  )
}

/**
 * The categories' sliding cards: the categories `carouselIds` picks, each
 * with its picture (on the home page a product's photo where the category
 * has none, as the tiles), its count while the shop shows counts, and the
 * scroller kit's settings as this build reads them. The cards are the
 * tiles' own, so a theme without the drawing draws the tiles. No category:
 * no section.
 */
export async function carouselCategoriesView(
  section: StoreCategoriesSection & StoreCategoriesCarousel,
  t: Translate,
  home: boolean
): Promise<HomeSectionView | null> {
  const handled = section.category_ids.length === 0 && (section.category_handles ?? []).length > 0
  const ids = handled ? carouselIds(section, await allCategories()) : section.category_ids
  const named = home ? await picturedCategories(ids) : (await namedCategories(ids)).named
  const categories = await withCounts(named, section.show_count === true)
  if (categories.length === 0) {
    return null
  }
  const more = layoutLink(section.more ?? null, t)
  return {
    id: section.id,
    type: "categories",
    title: section.title ?? t("home.shop_categories"),
    categories,
    ...(more ? { more } : {}),
    variant: "carousel",
    scroller: scrollerSettingsOf(section.scroller),
  }
}
