import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import { publishDueProducts } from "../workflows/catalog/publish-due"
import { isLockBusy } from "../workflows/pricing/price-history"

/**
 * Drafts whose planned publish has come go live (S2, docs/06 "Ürün
 * sayfası"), each minute, one run at a time across processes.
 */
export default async function productPublishSchedule(container: MedusaContainer) {
  try {
    const result = await container
      .resolve(Modules.LOCKING)
      .execute("product-publish-schedule", () => publishDueProducts(container), { timeout: 1 })
    if (result.published.length + result.held.length + result.failed.length > 0) {
      logger.info({
        event: "catalog.publish_schedule_ran",
        published: result.published.length,
        held: result.held.length,
        failed: result.failed.length,
      })
    }
  } catch (error) {
    if (isLockBusy(error)) {
      return
    }
    logger.error({ event: "catalog.publish_schedule_run_failed", err: errorSummary(error) })
  }
}

export const config = {
  name: "product-publish-schedule",
  schedule: "* * * * *",
}
