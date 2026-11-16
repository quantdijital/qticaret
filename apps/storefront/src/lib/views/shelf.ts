import "server-only"
import type { ProductSource, StoreProductsSection } from "@qticaret/types"
import { scrollerSettingsOf } from "@qticaret/types/section-scroller"
import { shelfLimit, shelfPerListOf, shelfRowsOf, shelfTabsOf } from "@qticaret/types/section-shelf"
import { shelfStripsOf } from "@qticaret/types/section-strips"
import { variantOf } from "@qticaret/types/section-variants"
import type { CardVariant, ProductsSectionView, ShelfListView, Translate } from "@qticaret/ui"
import { railCardVariant } from "./card-framed"
import { layoutLink } from "./layout"
import { railCards, railProducts } from "./section-data"

/** An untitled rail's name by where its products come from; the rest are "Yeni ürünler". */
const RAIL_TITLES: Partial<Record<ProductSource["kind"], string>> = {
  best_sellers: "home.best_sellers",
  on_sale: "home.on_sale",
}

/** A list's name: the shop's, else its source's. */
const titleOf = (list: { title: string | null; source: ProductSource }, t: Translate) =>
  list.title ?? t(RAIL_TITLES[list.source.kind] ?? "home.products")

/** A source with the backend's picks, as `railProducts` takes it. */
const sourceOf = (
  list: Pick<StoreProductsSection, "source" | "product_ids">,
  limit: number
): Parameters<typeof railProducts>[0] =>
  list.product_ids
    ? { source: list.source, limit, product_ids: list.product_ids }
    : { ...list, limit }

/**
 * A `columns` rail's lists side by side (adr/0049 Ek 2026-11-15): the
 * rail's own first, then its one or two more, each in compact cards, cut
 * to its count. A list with nothing to show (nothing on sale now) is left
 * out; none left, no rail.
 */
async function listViews(
  section: StoreProductsSection,
  limit: number,
  t: Translate
): Promise<ShelfListView[]> {
  const lists = [section, ...(section.lists ?? [])]
  const views = await Promise.all(
    lists.map(async (list, index) => ({
      id: `${section.id}-${String(index)}`,
      title: titleOf(list, t),
      products: await railCards(await railProducts(sourceOf(list, limit)), "compact"),
    }))
  )
  const kept = views.flatMap((view, at) => (view.products.length > 0 ? [{ view, at }] : []))
  // Once one is left out, each says its place in the design (the editor's field mark)
  return kept.every(({ at }, drawn) => at === drawn)
    ? kept.map(({ view }) => view)
    : kept.map(({ view, at }) => ({ ...view, at }))
}

/**
 * The card a rail draws: compact on a compact or columns rail, else its
 * own or the setting's. A strips rail draws no card: compact asks the
 * least of it (no framed card's second photo), its price as any card's.
 */
const cardOf = (variant: ProductsSectionView["variant"], section: StoreProductsSection) =>
  variant === "compact" || variant === "columns" || variant === "strips"
    ? ("compact" satisfies CardVariant)
    : railCardVariant(section)

/**
 * A product rail as the theme draws it (adr/0049 Ek 2026-11-05, Ek
 * 2026-11-15): its cards from its source, as many as its variant shows,
 * and its variant's own settings read forgivingly (a step this build does
 * not know is the default; a variant it does not know, a grid).
 */
export async function shelfView(
  section: StoreProductsSection,
  t: Translate
): Promise<ProductsSectionView | null> {
  const variant = variantOf("products", section.variant)
  const limit = shelfLimit({ ...section, variant })
  const base = {
    id: section.id,
    type: "products" as const,
    title: titleOf(section, t),
    more: layoutLink(section.more, t),
    empty: t("home.no_products"),
    variant,
    // Set apart from its neighbours' tabs (bilesen-denetimi (b) 2); none: it joins them
    ...(shelfTabsOf(section.tabs) === "off" ? { tabs: "off" as const } : {}),
  }
  if (variant === "columns") {
    const lists = await listViews(section, limit, t)
    const [first] = lists
    return first
      ? { ...base, products: first.products, lists, perList: shelfPerListOf(section.per_list) }
      : null
  }
  const products = await railCards(
    await railProducts(sourceOf(section, limit)),
    cardOf(variant, section)
  )
  // Nothing on sale now: no sale rail, rather than an empty one
  if (products.length === 0 && section.source.kind === "on_sale") {
    return null
  }
  return {
    ...base,
    products,
    ...(variant === "grid" && section.columns ? { columns: section.columns } : {}),
    ...(variant === "grid" && section.columns_mobile === 1 ? { phoneColumns: 1 as const } : {}),
    ...(variant === "carousel" ? { scroller: scrollerSettingsOf(section.scroller) } : {}),
    ...(variant === "compact" ? { rows: shelfRowsOf(section.rows) } : {}),
    ...(variant === "strips" ? { strips: shelfStripsOf(section) } : {}),
  }
}
