import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import type { BodySection } from "../../lib/storefront/layout"
import { bandRanges } from "../../lib/storefront/sections/price-bands"
import { SEARCH_INDEX_MODULE } from "../../modules/search-index"
import type SearchIndexModuleService from "../../modules/search-index/service"
import { CURRENCY } from "../catalog/prices"
import { priceKey } from "../seo/listing-plan"

type Channels = readonly string[] | null

/** A price bands section's products, per band in its order. */
export type BandPick = string[][]

/**
 * The products a price bands strip shows small (adr/0049 Ek 2026-11-14,
 * note "Katalog ana sayfası"), picked here for the shopper's sales
 * channels: each band's published products whose indexed price in the
 * shop's currency (the price the cards show, `search/prices.ts`) lies in
 * its range, those in stock first, then the newest; a product shown in an
 * earlier band is not shown again. The prices are the server's, never the
 * design's (golden rule 5). A strip the backend cannot pick is logged and
 * shown without products.
 */

/** The price key of the region the storefront asks every price in (the lira's; one until F19). */
async function liraKey(container: MedusaContainer): Promise<string | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "region",
    fields: ["id", "currency_code"],
    filters: { currency_code: CURRENCY },
  })
  const [region] = data as { id: string }[]
  return region ? priceKey(region.id, CURRENCY) : null
}

async function pickBands(
  container: MedusaContainer,
  section: Extract<BodySection, { type: "price_bands" }>,
  key: string,
  channels: Channels
): Promise<BandPick> {
  const index = container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE)
  const ranges = bandRanges(section.bands)
  // Enough to skip what the bands before showed
  const limit = section.thumbs * ranges.length
  const found = await Promise.all(
    ranges.map(async ({ min, max }) => {
      const { ids } = await index.listing({
        channels: channels && [...channels],
        scope: {},
        text: null,
        filters: { brands: null, options: [], in_stock: false },
        price: { key, min, max },
        sort: "relevance",
        page: { offset: 0, limit },
      })
      return ids
    })
  )
  const shown = new Set<string>()
  return found.map((ids) => {
    const picked = ids.filter((id) => !shown.has(id)).slice(0, section.thumbs)
    picked.forEach((id) => shown.add(id))
    return picked
  })
}

/** The price bands strips' products among these sections, by section id; all at once. */
export async function bandPicks(
  container: MedusaContainer,
  sections: readonly BodySection[],
  channels: Channels
): Promise<Map<string, BandPick>> {
  const strips = sections.filter(
    (section): section is Extract<BodySection, { type: "price_bands" }> =>
      section.type === "price_bands" && section.thumbs > 0
  )
  if (strips.length === 0) {
    return new Map()
  }
  try {
    const key = await liraKey(container)
    if (!key) {
      return new Map()
    }
    const picks = await Promise.all(
      strips.map(
        async (section) => [section.id, await pickBands(container, section, key, channels)] as const
      )
    )
    return new Map(picks)
  } catch (error) {
    logger.warn({ event: "storefront.price_bands_failed", err: errorSummary(error) })
    return new Map()
  }
}
