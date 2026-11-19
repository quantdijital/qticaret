import type { MedusaContainer } from "@medusajs/framework/types"
import type { BodySection } from "../../lib/storefront/layout"
import type { MenuLinkInput } from "../../lib/storefront/menus"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { shopInfoValues } from "../shop/info-values"
import type { HydrateContext } from "./layout-hydrate"
import type { LiveFilter } from "./layout-live"
import { resolveLinks } from "./menu-links"
import { bandPicks } from "./price-bands"
import { railPicks } from "./rails"

/** What a group's sections are hydrated with, gathered at once. */
export interface ContextInput {
  /** Every link the shown sections hold, in any order (each looked up once by identity). */
  links: readonly MenuLinkInput[]
  /** The images shown with their sizes. */
  urls: readonly string[]
  /** The sections whose sale and best-seller rails and price bands are picked here. */
  picked: readonly BodySection[]
  /** The shopper's sales channels (the publishable key's); null: any. */
  channels: readonly string[] | null
  /** The live filter the sections went through (`liveRecords`). */
  live: LiveFilter["live"]
}

/**
 * What the design's sections are drawn with (adr/0049): the shop's details,
 * the links named and placed as their records are now (a broken one null),
 * the images with their sizes and versions, a sale or best-seller rail's
 * and a price band's products picked for the shopper's sales channels.
 * Shared by the whole design's read and a content page's (adr/0073 §6).
 */
export async function hydrateContext(
  container: MedusaContainer,
  input: ContextInput
): Promise<HydrateContext> {
  const { links, urls } = input
  const [values, resolved, assets, picks, bands] = await Promise.all([
    shopInfoValues(container),
    resolveLinks(
      container,
      links.map((each, index) => ({
        id: String(index),
        parent_id: null,
        rank: index,
        label: each.label,
        kind: each.kind,
        target: "target" in each ? each.target : null,
        url: "url" in each ? each.url : null,
      }))
    ),
    urls.length
      ? container
          .resolve<MediaModuleService>(MEDIA_MODULE)
          .listMediaAssets(
            { url: [...new Set(urls)] },
            { select: ["url", "alt", "width", "height", "derivatives"] }
          )
      : Promise.resolve([]),
    railPicks(container, input.picked, input.channels),
    bandPicks(container, input.picked, input.channels),
  ])
  return {
    values,
    container,
    picks,
    bands,
    live: input.live,
    images: new Map(
      assets.map((asset) => [
        asset.url,
        {
          url: asset.url,
          alt: asset.alt ?? null,
          width: asset.width ?? null,
          height: asset.height ?? null,
          derivatives: asset.derivatives ?? null,
        },
      ])
    ),
    links: new Map(
      links.map((each, index) => {
        const shown = resolved.get(String(index))
        return [
          each,
          !shown || shown.broken
            ? null
            : {
                label: each.label ?? shown.name,
                kind: each.kind,
                target: "target" in each ? each.target : null,
                path: shown.path,
              },
        ]
      })
    ),
  }
}
