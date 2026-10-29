import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { FEED_FORMATTERS, excludedBy, googleFeedProblems } from "../../lib/feeds"
import { errorSummary, logger } from "../../lib/logging"
import { MARKETING_FEEDS_MODULE } from "../../modules/marketing-feeds"
import type MarketingFeedsModuleService from "../../modules/marketing-feeds/service"
import { brandOf } from "../messaging/brand"
import { catalogItems, feedShopOf } from "./feed-catalog"

/**
 * Writes each target's feed to the shop's private storage and records it,
 * without the categories the shop keeps out of it; the file it replaces
 * goes once the new one is recorded. Nothing while
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
    const storefront = { shopName: brand.shopName, storefrontUrl: brand.storefrontUrl }
    const [items, { shop, exclusions }] = await Promise.all([
      catalogItems(container, brand.storefrontUrl),
      feedShopOf(container, storefront),
    ])
    const files = container.resolve(Modules.FILE)
    for (const formatter of FEED_FORMATTERS) {
      const listed = items.filter(
        (item) => formatter.accepts(item) && !excludedBy(item, exclusions[formatter.target])
      )
      const body = formatter.render(listed, shop)
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
