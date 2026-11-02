import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { errorSummary, logger } from "../lib/logging"
import { LAYOUT_PUBLISHED } from "../workflows/storefront/layout"
import { refreshStorefrontWorkflow } from "../workflows/storefront/steps/refresh-storefront"

/**
 * A design gone live shows on the storefront at once (adr/0048 ek
 * 2026-11-03), not within its cache's minute. The event comes once the
 * publication's workflow has finished; a failure here never touches it.
 */
export default async function storefrontRefresh({ container }: SubscriberArgs) {
  try {
    await refreshStorefrontWorkflow(container).run({ input: ["layout"] })
  } catch (error) {
    logger.warn({ event: "storefront.refresh_failed", err: errorSummary(error) })
  }
}

export const config: SubscriberConfig = {
  event: LAYOUT_PUBLISHED,
}
