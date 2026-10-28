import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { FEED_FORMATTERS, feedItemsOf, googleFeedProblems } from "../../lib/feeds"
import type { FeedItem } from "../../lib/feeds"
import { errorSummary, logger } from "../../lib/logging"
import { plainText } from "../../lib/seo/resolve"
import { MARKETING_FEEDS_MODULE } from "../../modules/marketing-feeds"
import type MarketingFeedsModuleService from "../../modules/marketing-feeds/service"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../catalog/entity-paths"
import { brandOf } from "../messaging/brand"
import { priceDisplays } from "../pricing/price-display"
import { PRODUCT_FACT_FIELDS, productFacts } from "../seo/facts"
import type { FactRow } from "../seo/facts"
import { shippingFactsOf } from "../seo/payload"

/** Products read at a time. */
const PAGE = 200

interface FeedProductRow extends FactRow {
  id: string
  description?: string | null
  brand?: { name: string } | null
}

/**
 * Every published product with a storefront address, as feed items: the
 * same facts, prices (the 30-day rule's too) and shipping rates the page's
 * JSON-LD is built from (docs/13 §10).
 */
async function catalogItems(container: MedusaContainer, storefront: string): Promise<FeedItem[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const urls = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  const shipping = await shippingFactsOf(container)
  const items: FeedItem[] = []
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title", "description", "brand.name", ...PRODUCT_FACT_FIELDS],
      filters: { status: "published" },
      pagination: { skip, take: PAGE, order: { created_at: "ASC" } },
    })
    const rows = data as FeedProductRow[]
    const entries = await urls.listUrlEntries(
      {
        locale: CATALOG_LOCALE,
        entity_type: CATALOG_ENTITY_TYPES.product,
        entity_id: rows.map((row) => row.id),
        status: "active",
      },
      { select: ["entity_id", "path"], take: rows.length }
    )
    const paths = new Map(entries.map((entry) => [entry.entity_id, entry.path]))
    const displays = await priceDisplays(
      container,
      rows.flatMap((row) =>
        (row.variants ?? []).flatMap((variant) => (variant ? [variant.id] : []))
      ),
      "try"
    )
    for (const row of rows) {
      const path = paths.get(row.id)
      if (path) {
        const facts = productFacts(
          row,
          row.brand?.name ?? null,
          plainText(row.description ?? ""),
          displays,
          shipping
        )
        items.push(...feedItemsOf(facts, `${storefront}${path}`))
      }
    }
    if (rows.length < PAGE) {
      return items
    }
  }
}

/**
 * Writes each target's feed to the shop's private storage and records it;
 * the file it replaces goes once the new one is recorded. Nothing while
 * feeds are off or the shop has no storefront domain to link to. A file
 * written but not recorded is removed again.
 */
const generateFeedsStep = createStep(
  "marketing-generate-feeds",
  async (input: { trigger: "schedule" | "panel" }, { container }) => {
    const feeds = container.resolve<MarketingFeedsModuleService>(MARKETING_FEEDS_MODULE)
    const brand = await brandOf(container)
    if (!brand.storefrontUrl || (await feeds.currentToken()) === null) {
      return new StepResponse({ items: 0, generated: false })
    }
    const items = await catalogItems(container, brand.storefrontUrl)
    const files = container.resolve(Modules.FILE)
    for (const formatter of FEED_FORMATTERS) {
      const listed = items.filter(formatter.accepts)
      const body = formatter.render(listed, { name: brand.shopName, url: brand.storefrontUrl })
      if (formatter.target === "google") {
        const problems = googleFeedProblems(body)
        if (problems.length > 0) {
          logger.warn({ event: "marketing_feeds.google_problems", count: problems.length })
        }
      }
      const upload = await files.getUploadStream({
        // Not guessable: a local or development store guards files by their name only
        filename: `feed-${formatter.target}-${randomUUID()}.${formatter.extension}`,
        mimeType: formatter.contentType.split(";")[0] ?? formatter.contentType,
        access: "private",
      })
      upload.writeStream.end(Buffer.from(body, "utf8"))
      await upload.promise
      let replaced: string | null
      try {
        replaced = await feeds.recordFile({
          target: formatter.target,
          file_key: upload.fileKey,
          item_count: listed.length,
        })
      } catch (error) {
        await files.deleteFiles(upload.fileKey)
        throw error
      }
      if (replaced) {
        await files.deleteFiles(replaced).catch((error: unknown) => {
          logger.warn({ event: "marketing_feeds.old_file_kept", err: errorSummary(error) })
        })
      }
    }
    logger.info({ event: "marketing_feeds.generated", trigger: input.trigger, items: items.length })
    return new StepResponse({ items: items.length, generated: true })
  }
)

/** The shop's product feeds, built again from its catalog (F10.8, adr/0038 §3). */
export const generateFeedsWorkflow = createWorkflow(
  "marketing-generate-feeds",
  (input: { trigger: "schedule" | "panel" }) => new WorkflowResponse(generateFeedsStep(input))
)
