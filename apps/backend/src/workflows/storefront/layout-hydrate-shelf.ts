import type { RailPick } from "../../lib/storefront/rails"
import { listKey } from "../../lib/storefront/sections/products"
import type { ProductsSection } from "../../lib/storefront/sections/products"

/**
 * A product rail as the storefront prints it (adr/0049 Ek 2026-11-15): the
 * fields every variant has, its variant's own, and a sale or best-seller
 * source's products picked in order (each of a columns rail's lists too).
 */
export function hydrateShelf<L>(
  section: ProductsSection,
  picks: ReadonlyMap<string, RailPick> | undefined,
  more: L
) {
  const common = {
    id: section.id,
    type: section.type,
    variant: section.variant,
    title: section.title,
    source: section.source,
    limit: section.limit,
    more,
    card_variant: section.card_variant,
    // Printed only when set apart, so a rail from before it prints as it did
    ...(section.tabs === "off" ? { tabs: "off" as const } : {}),
    // A sale or best-seller rail: its products in order, and whether the newest made it up
    ...picks?.get(section.id),
  }
  switch (section.variant) {
    case "grid":
      return {
        ...common,
        columns: section.columns,
        // Printed only when not the default (2), so a rail from before it prints as it did
        ...(section.columns_mobile === 1 ? { columns_mobile: 1 as const } : {}),
      }
    case "carousel":
      return { ...common, scroller: section.scroller }
    case "compact":
      return { ...common, rows: section.rows }
    case "columns":
      return {
        ...common,
        per_list: section.per_list,
        lists: section.lists.map((list, index) => ({
          title: list.title,
          source: list.source,
          ...picks?.get(listKey(section.id, index)),
        })),
      }
    case "featured":
      return common
  }
}
