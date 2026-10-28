import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { CUSTOMER_SEGMENTS_MODULE } from "../modules/customer-segments"
import type CustomerSegmentsModuleService from "../modules/customer-segments/service"
import { refreshSegmentWorkflow } from "../workflows/customers/segments"

/**
 * Every segment's group filled again from its rules (F10.3, adr/0037 §6):
 * spending and recency change by the day. One segment's failure leaves
 * the others to refresh.
 */
export default async function customerSegmentsRefresh(container: MedusaContainer) {
  const segments = await container
    .resolve<CustomerSegmentsModuleService>(CUSTOMER_SEGMENTS_MODULE)
    .listCustomerSegments({}, { select: ["id"] })
  let refreshed = 0
  for (const { id } of segments) {
    try {
      await refreshSegmentWorkflow(container).run({ input: { segment_id: id } })
      refreshed += 1
    } catch (error) {
      logger.warn({
        event: "customer_segments.refresh_failed",
        segment_id: id,
        err: errorSummary(error),
      })
    }
  }
  logger.info({ event: "customer_segments.refreshed", refreshed, total: segments.length })
}

export const config = {
  name: "customer-segments-refresh",
  // 03:00 UTC (06:00 in Türkiye), before the shop opens its promotions
  schedule: "0 3 * * *",
}
