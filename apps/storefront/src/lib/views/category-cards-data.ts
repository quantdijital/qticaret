import "server-only"
import type {
  StoreCategoriesCollage,
  StoreCategoriesLinked,
  StoreCategoriesSection,
} from "@qticaret/types"
import {
  CATEGORY_CARD_DEFAULTS,
  CATEGORY_CARD_LIMITS,
  CATEGORY_CARD_SETTINGS,
  CATEGORY_COLLAGE_DEFAULTS,
  CATEGORY_COLLAGE_SETTINGS,
} from "@qticaret/types/section-categories"
import type {
  CategoryCardsView,
  CategoryCollageView,
  LinkedCategoryCardView,
  Translate,
} from "@qticaret/ui"
import { allCategories, pathsOf } from "@/lib/store-api/requests"
import { categoryCounts } from "@/lib/store-api/extras"
import { picturedCategories } from "./category-tiles"
import { cardsView, childIds, collageView, linkedCards } from "./category-cards"
import { namedCategories } from "./section-data"

/** A setting's step as a reader takes it: one on the list as it is, anything else the default. */
function stepOf<S extends keyof typeof CATEGORY_CARD_SETTINGS>(
  setting: S,
  value: unknown
): (typeof CATEGORY_CARD_SETTINGS)[S][number] {
  const listed: readonly unknown[] = CATEGORY_CARD_SETTINGS[setting]
  return listed.includes(value)
    ? (value as (typeof CATEGORY_CARD_SETTINGS)[S][number])
    : CATEGORY_CARD_DEFAULTS[setting]
}

/** A link count as a reader takes it: a whole number held to its bounds, else the variant's default. */
const linksOf = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isInteger(value)
    ? Math.min(Math.max(value, CATEGORY_CARD_LIMITS.links.min), CATEGORY_CARD_LIMITS.links.max)
    : fallback

/** The collage's settings as this build reads them (forgiving: off the list, the default). */
export function collageSettings(section: Partial<StoreCategoriesCollage>): StoreCategoriesCollage {
  const step = <S extends keyof typeof CATEGORY_COLLAGE_SETTINGS>(
    setting: S,
    value: unknown
  ): (typeof CATEGORY_COLLAGE_SETTINGS)[S][number] =>
    (CATEGORY_COLLAGE_SETTINGS[setting] as readonly unknown[]).includes(value)
      ? (value as (typeof CATEGORY_COLLAGE_SETTINGS)[S][number])
      : CATEGORY_COLLAGE_DEFAULTS[setting]
  return {
    variant: "collage",
    columns: step("columns", section.columns),
    columns_mobile: step("columns_mobile", section.columns_mobile),
    height: step("height", section.height),
    lead: step("lead", section.lead),
    links: linksOf(section.links, CATEGORY_COLLAGE_DEFAULTS.links),
  }
}

/** The linked settings as this build reads them (forgiving: off the list, the default). */
export function linkedSettings(section: Partial<StoreCategoriesLinked>): StoreCategoriesLinked {
  const links = linksOf(section.links, CATEGORY_CARD_DEFAULTS.links)
  return {
    variant: "linked",
    columns: stepOf("columns", section.columns),
    columns_mobile: stepOf("columns_mobile", section.columns_mobile),
    image_position: stepOf("image_position", section.image_position),
    frame: stepOf("frame", section.frame),
    links,
  }
}

/**
 * The linked cards fetched: the categories named (or the top ones), their
 * pictures (on the home page a product's photo where the category has
 * none, as the tiles), their subcategories' paths in one request and the
 * shop's counts (kept a minute), which also leave out empty subcategories.
 */
export async function linkedCategoriesView(
  section: StoreCategoriesSection & StoreCategoriesLinked,
  t: Translate,
  home: boolean
): Promise<{ cards: LinkedCategoryCardView[]; linked: CategoryCardsView }> {
  const settings = linkedSettings(section)
  const cards = await fetchedCards(section, settings, settings.image_position !== "none" && home, t)
  return { cards, linked: cardsView(settings, cards) }
}

/**
 * The collage's cards fetched as the linked ones, always with their
 * pictures (on the home page a product's photo where the category has none).
 */
export async function collageCategoriesView(
  section: StoreCategoriesSection & StoreCategoriesCollage,
  t: Translate,
  home: boolean
): Promise<{ cards: LinkedCategoryCardView[]; collage: CategoryCollageView }> {
  const settings = collageSettings(section)
  const cards = await fetchedCards(section, { ...settings, image_position: "top" }, home, t)
  return { cards, collage: collageView(settings, cards) }
}

/** The named categories (or the top ones), their subcategories' paths and the shop's counts. */
async function fetchedCards(
  section: StoreCategoriesSection,
  settings: Pick<StoreCategoriesLinked, "links" | "image_position">,
  pictured: boolean,
  t: Translate
): Promise<LinkedCategoryCardView[]> {
  const [named, all, counts] = await Promise.all([
    pictured
      ? picturedCategories(section.category_ids)
      : namedCategories(section.category_ids).then((found) => found.named),
    allCategories(),
    categoryCounts(),
  ])
  const paths = settings.links > 0 ? await pathsOf("product_category", childIds(named, all)) : {}
  return linkedCards(
    named,
    all,
    paths,
    counts,
    { ...settings, show_count: section.show_count === true },
    t
  )
}
