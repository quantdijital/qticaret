import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { SEO_REDIRECTS_MODULE } from "../modules/seo-redirects"
import type SeoRedirectsModuleService from "../modules/seo-redirects/service"

// docs/13 §6: a moved site is watched for 30 days; three months covers that
const KEEP_MS = 90 * 24 * 60 * 60 * 1000
// Rows the panel can still page through; the long tail of one-off typos goes
const KEEP_ROWS = 10_000

/**
 * Keeps the 404 log (docs/13 §4) to what is worth acting on: paths nobody
 * asked for in 90 days go, and only the 10,000 most asked for stay.
 */
export default async function seoNotFoundRetention(container: MedusaContainer) {
  const service = container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
  const removed = await service.pruneNotFound({
    before: new Date(Date.now() - KEEP_MS),
    keep: KEEP_ROWS,
  })
  logger.info({ event: "seo.not_found_retention", removed })
}

export const config = {
  name: "seo-not-found-retention",
  schedule: "45 3 * * *",
}
