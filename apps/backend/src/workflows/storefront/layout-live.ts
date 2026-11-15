import type { MedusaContainer } from "@medusajs/framework/types"
import type { BodySection } from "../../lib/storefront/layout"
import type { RecordLinkKind } from "../../lib/storefront/menus"
import { shelfSources } from "../../lib/storefront/sections/products"
import { resolveLinks } from "./menu-links"
import type { StoredLink } from "./menu-links"

/** Where a rail or a related rail takes its products from. */
type AnySource = Extract<BodySection, { type: "products" | "related_products" }>["source"]

/**
 * Keeps a group's sections with only the records live now; `live` asks of
 * one record, for a section that keeps its items' saved places (a strip
 * gallery's `at`, the editor's field marks) and leaves a gone one out
 * itself.
 */
export type LiveFilter = (<T extends BodySection>(group: readonly T[]) => T[]) & {
  live: (kind: RecordLinkKind, id: string) => boolean
}

/** A filter of these sections over this test of one record. */
const filterOf = (
  keep: (section: BodySection) => BodySection[],
  live: LiveFilter["live"]
): LiveFilter =>
  // A kept section is the one given, or a copy of it with fewer ids: of its own type
  Object.assign(
    <T extends BodySection>(group: readonly T[]) => group.flatMap((each) => keep(each) as T[]),
    { live }
  )

/**
 * The sections with only the records live now (security review 2026-11-02,
 * L8): a draft product's or an inactive category's id never leaves the
 * backend. A section whose every chosen record is gone, or whose rail's
 * category or collection is, is left out (an emptied choice would read as
 * "the top categories" or "every brand"); a price band whose category is
 * not live is left out of its strip; a strip gallery is kept whole, its
 * gone items left out on hydrating (`live`), so the rest keep their saved
 * places, and left out when none is live. A product page's "same category"
 * names no record: the storefront takes the product's own. The records of
 * every group are looked up at once.
 */
export async function liveRecords(
  container: MedusaContainer,
  sections: readonly BodySection[]
): Promise<LiveFilter> {
  const wanted = new Map<string, StoredLink>()
  const want = (kind: RecordLinkKind, target: string) =>
    wanted.set(`${kind}:${target}`, {
      id: `${kind}:${target}`,
      parent_id: null,
      rank: 0,
      label: null,
      kind,
      target,
      url: null,
    })
  for (const section of sections) {
    if (section.type === "categories") {
      section.category_ids.forEach((id) => want("category", id))
    } else if (section.type === "brands") {
      section.brand_ids.forEach((id) => want("brand", id))
    } else if (section.type === "hero" && section.variant === "category_list") {
      if (section.list.kind === "manual")
        section.list.category_ids.forEach((id) => want("category", id))
      section.tiles.forEach((tile) => want("category", tile.category_id))
      section.picks.forEach((pick) => want("product", pick.product_id))
    } else if (section.type === "featured_product") {
      want("product", section.product_id)
    } else if (section.type === "strip_gallery") {
      for (const each of section.items)
        if (each.source.kind !== "custom") want(each.source.kind, each.source.target)
    } else if (section.type === "price_bands") {
      for (const band of section.bands) if (band.category_id) want("category", band.category_id)
    } else if (section.type === "products" || section.type === "related_products") {
      const sources =
        section.type === "products"
          ? shelfSources(section).map(({ source }) => source)
          : [section.source]
      for (const source of sources) {
        if (source.kind === "category") want("category", source.category_id)
        if (source.kind === "collection") want("collection", source.collection_id)
        if (source.kind === "manual") source.product_ids.forEach((id) => want("product", id))
      }
    }
  }
  if (wanted.size === 0) {
    return filterOf(
      (section) => [section],
      () => true
    )
  }
  const resolved = await resolveLinks(container, [...wanted.values()])
  const live = (kind: RecordLinkKind) => (id: string) =>
    resolved.get(`${kind}:${id}`)?.broken === false
  /** A source as it stands now: its category or collection live, its chosen products those live; else null. */
  function liveSource<S extends AnySource>(source: S): S | null {
    if (source.kind === "category") {
      return live("category")(source.category_id) ? source : null
    }
    if (source.kind === "collection") {
      return live("collection")(source.collection_id) ? source : null
    }
    if (source.kind === "manual") {
      const ids = source.product_ids.filter(live("product"))
      return ids.length > 0 ? { ...source, product_ids: ids } : null
    }
    return source
  }
  const keep = (section: BodySection): BodySection[] => {
    if (section.type === "categories" && section.category_ids.length > 0) {
      const ids = section.category_ids.filter(live("category"))
      return ids.length > 0 ? [{ ...section, category_ids: ids }] : []
    }
    // H17 keeps its opening: a gone tile or product is left out, an emptied list is the top categories
    if (section.type === "hero" && section.variant === "category_list") {
      const listed = section.list.kind === "manual" ? section.list.category_ids : []
      const kept = listed.filter(live("category"))
      return [
        {
          ...section,
          list:
            kept.length > 0
              ? { kind: "manual", category_ids: kept }
              : section.list.kind === "manual"
                ? { kind: "top" }
                : section.list,
          tiles: section.tiles.filter((tile) => live("category")(tile.category_id)),
          picks: section.picks.filter((pick) => live("product")(pick.product_id)),
        },
      ]
    }
    // A featured product that is not live now: no close-up of nothing
    if (section.type === "featured_product") {
      return live("product")(section.product_id) ? [section] : []
    }
    // A strip gallery keeps its items (their saved places are the hydrate's), unless none is live
    if (section.type === "strip_gallery") {
      const any = section.items.some(
        (each) => each.source.kind === "custom" || live(each.source.kind)(each.source.target)
      )
      return any ? [section] : []
    }
    // A band whose category is not live is left out: none of its products shown under it
    if (section.type === "price_bands") {
      const bands = section.bands.filter(
        (band) => !band.category_id || live("category")(band.category_id)
      )
      return bands.length > 0 ? [{ ...section, bands }] : []
    }
    if (section.type === "brands" && section.brand_ids.length > 0) {
      const ids = section.brand_ids.filter(live("brand"))
      return ids.length > 0 ? [{ ...section, brand_ids: ids }] : []
    }
    if (section.type === "related_products") {
      const source = liveSource(section.source)
      return source ? [{ ...section, source }] : []
    }
    if (section.type === "products") {
      const source = liveSource(section.source)
      if (source === null) {
        return []
      }
      // A columns rail's list whose records are gone is left out; the rail's own decides the rail
      if (section.variant === "columns") {
        const lists = section.lists.flatMap((list) => {
          const kept = liveSource(list.source)
          return kept ? [{ ...list, source: kept }] : []
        })
        return [{ ...section, source, lists }]
      }
      return [{ ...section, source }]
    }
    return [section]
  }
  return filterOf(keep, (kind, id) => live(kind)(id))
}
