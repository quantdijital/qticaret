import "server-only"
import type {
  HeroListSource,
  StoreHeroCatalog,
  StoreHeroSection,
  StoreLayoutLink,
  StorePriceBandsSection,
} from "@qticaret/types"
import { formatLira } from "@qticaret/ui"
import type {
  CategoryCardView,
  HeroCatalogView,
  HomeSectionView,
  PriceBandsSectionView,
  ProductThumbView,
  Translate,
} from "@qticaret/ui"
import { pathsOf, priceDisplays, siteSeo } from "@/lib/store-api/requests"
import { categoryCounts } from "@/lib/store-api/extras"
import { picturedCategories } from "./category-tiles"
import { productImages } from "./image"
import { currentMenus, layoutImage, layoutLink, layoutLinks } from "./layout"
import { heroCatalogSlides } from "./hero-slides"
import { hrefOf } from "./listing"
import { isVatExclusive, shownAmount } from "./price"
import { variantIdsOf } from "./product"
import { namedCategories, productsInOrder } from "./section-data"

/**
 * The catalogue home page's sections as the theme draws them (adr/0049
 * Ek 2026-11-14 §3.2 H17, and the note "Katalog ana sayfası"): their
 * categories with their pictures (the shop's, else the newest product's
 * photo) and their counts from the backend's one count of the tree
 * (`/store/category-counts`), their products live, their prices the
 * server's.
 */

/**
 * The categories the list shows: the shop's pick, its header menu's
 * categories, or (null) the top ones.
 */
async function listedIds(list: HeroListSource): Promise<string[] | null> {
  if (list.kind === "manual") {
    return list.category_ids
  }
  if (list.kind === "menu") {
    const main = (await currentMenus()).find((menu) => menu.location === "main")
    return (main?.items ?? []).flatMap((item) =>
      item.kind === "category" && item.target ? [item.target] : []
    )
  }
  return null
}

/**
 * The categories named, with their pictures; none named, none (an empty
 * list here never means "the top ones", and asks nothing).
 */
const named = async (ids: readonly string[], limit?: number) =>
  ids.length > 0 ? picturedCategories(ids, limit) : []

/** A card with its count when the shop shows counts and the backend counted it. */
const counted = (
  card: CategoryCardView,
  id: string,
  counts: ReadonlyMap<string, number>,
  show: boolean
): CategoryCardView => {
  const count = show ? counts.get(id) : undefined
  return count === undefined ? card : { ...card, count }
}

/** Products shown small, in the order given; a product no longer live is left out. */
async function thumbs(
  ids: readonly string[],
  labels: ReadonlyMap<string, string | null> = new Map()
): Promise<{ views: Map<string, ProductThumbView>; lowest: number | null }> {
  const products = await productsInOrder(ids)
  if (products.length === 0) {
    return { views: new Map(), lowest: null }
  }
  const [paths, displays] = await Promise.all([
    pathsOf(
      "product",
      products.map((product) => product.id)
    ),
    priceDisplays(variantIdsOf(products)),
  ])
  const views = new Map<string, ProductThumbView>()
  const amounts: number[] = []
  for (const product of products) {
    const path = paths[product.id]
    if (!path) {
      continue
    }
    const [image] = productImages(product)
    views.set(product.id, {
      label: labels.get(product.id) ?? product.title,
      path,
      image: image ? { ...image, alt: "" } : null,
    })
    for (const variant of product.variants ?? []) {
      // A bare "from" amount carries no note: never a wholesaler's price without KDV (ADR-0068)
      const amount = isVatExclusive(variant, displays) ? null : shownAmount(variant, displays)
      if (amount !== null) {
        amounts.push(amount)
      }
    }
  }
  return { views, lowest: amounts.length > 0 ? Math.min(...amounts) : null }
}

/**
 * H17's own parts: its list, tiles and quick links with pictures and
 * counts, its picks, "from", and its slides when the shop saved them.
 */
export async function heroCatalogView(
  section: StoreHeroCatalog,
  t: Translate
): Promise<HeroCatalogView> {
  const chipIds = section.chips.flatMap((chip) =>
    chip.kind === "category" && chip.target ? [chip.target] : []
  )
  const tileIds = section.tiles.map((tile) => tile.category_id)
  const [listed, tiles, chipCards, counts, picks] = await Promise.all([
    // Cut to the list's limit before any photo is asked for
    listedIds(section.list).then((ids) =>
      ids === null ? picturedCategories([], section.list_limit) : named(ids, section.list_limit)
    ),
    named(tileIds),
    named(chipIds),
    categoryCounts(),
    thumbs(
      section.picks.map((pick) => pick.product_id),
      new Map(section.picks.map((pick) => [pick.product_id, pick.label]))
    ),
  ])
  const chipPictures = new Map(chipCards.map(({ id, card }) => [id, card.image ?? null]))
  const chipView = (chip: StoreLayoutLink): CategoryCardView[] => {
    const link = layoutLink(chip, t)
    const image = chip.kind === "category" && chip.target ? chipPictures.get(chip.target) : null
    return link ? [image ? { ...link, image } : link] : []
  }
  const ownImages = new Map(section.tiles.map((tile) => [tile.category_id, tile.image]))
  return {
    list: listed.map(({ id, card }) => counted(card, id, counts, section.show_count)),
    all: { label: t("home.all_categories"), path: "/kategoriler" },
    tiles: tiles.map(({ id, card }) => {
      const own = ownImages.get(id)
      const shown = own ? { ...card, image: layoutImage(own, card.label) } : card
      return counted(shown, id, counts, section.show_count)
    }),
    chips: section.chips.flatMap(chipView),
    picks: section.picks.flatMap((pick) => picks.views.get(pick.product_id) ?? []),
    from: section.show_price && picks.lowest !== null ? formatLira(picks.lowest) : null,
    ...heroCatalogSlides(section, t),
  }
}

/**
 * The opening (adr/0049): the shop's heading (else its name), line,
 * buttons and picture; drawn as H17 with its own parts when the shop chose
 * the category list.
 */
export async function heroView(section: StoreHeroSection, t: Translate): Promise<HomeSectionView> {
  const site = await siteSeo()
  const heading = section.heading ?? site.shop.name
  return {
    id: section.id,
    type: "hero",
    eyebrow: section.eyebrow,
    heading,
    intro: section.text,
    ...layoutLinks(section.links, t),
    image: section.image ? layoutImage(section.image, heading) : null,
    ...(section.variant === "category_list"
      ? { variant: section.variant, catalog: await heroCatalogView(section, t) }
      : {}),
  }
}

/**
 * A band's listing filtered by its range: the catalogue's
 * (`/magaza?fiyat=min-max`), or its category's page (`/kategori/…`, the
 * same `fiyat=` filter); without a range, the listing unfiltered.
 */
export const bandPath = (min: number | null, max: number | null, listing = "/magaza"): string =>
  hrefOf(listing, {
    filters: [],
    price: min === null && max === null ? null : { min, max },
    sort: null,
    page: 1,
  })

/**
 * The price bands: each band at its filtered listing with its products,
 * picked on the server; a band with a category at its category's page, the
 * category's name on it. A band whose category the Store API does not show
 * (hidden since the design was read) is left out.
 */
export async function priceBandsView(
  section: StorePriceBandsSection,
  t: Translate
): Promise<PriceBandsSectionView | null> {
  const categoryIds = section.bands.flatMap((band) => band.category_id ?? [])
  const [{ views }, categories] = await Promise.all([
    thumbs(section.bands.flatMap((band) => band.product_ids)),
    // An empty list would ask for the top categories
    categoryIds.length > 0 ? namedCategories(categoryIds) : null,
  ])
  const shown = new Map(categories?.named.map(({ id, card }) => [id, card]))
  const kept = section.bands.flatMap((band, at) => {
    const products = band.product_ids.flatMap((id) => views.get(id) ?? [])
    if (!band.category_id) {
      const view = { label: band.label, text: band.text, path: bandPath(band.min, band.max) }
      return [{ at, view: { ...view, products } }]
    }
    const card = shown.get(band.category_id)
    return card
      ? [
          {
            at,
            view: {
              label: band.label,
              text: band.text,
              category: card.label,
              path: bandPath(band.min, band.max, card.path),
              products,
            },
          },
        ]
      : []
  })
  // Once a band is left out, each says its place in the design (the editor's field mark)
  const moved = kept.some(({ at }, drawn) => at !== drawn)
  const bands = kept.map(({ at, view }) => (moved ? { ...view, at } : view))
  if (bands.length === 0) {
    return null
  }
  return {
    id: section.id,
    type: "price_bands",
    title: section.title ?? t("home.price_bands"),
    bands,
  }
}

/** The category cards' counts, when the section shows them. */
export async function withCounts(
  cards: readonly { id: string; card: CategoryCardView }[],
  show: boolean
): Promise<CategoryCardView[]> {
  const counts = show ? await categoryCounts() : new Map<string, number>()
  return cards.map(({ id, card }) => counted(card, id, counts, show))
}
