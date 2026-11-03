import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import { dispatchCampaignsWorkflow } from "../workflows/campaigns/jobs"
import { isLockBusy } from "../workflows/pricing/price-history"

/**
 * Bulk messages (adr/0050 §6): each minute one turn of the campaign
 * sending, at most 120 recipients two a second; schedules reached and
 * pauses the clock ends resume here. One process at a time: a turn still
 * running elsewhere leaves this minute's run nothing to do.
 */
export default async function campaignDispatch(container: MedusaContainer) {
  try {
    const result = await container
      .resolve(Modules.LOCKING)
      .execute(
        "campaigns:dispatch",
        async () => (await dispatchCampaignsWorkflow(container).run({ input: {} })).result,
        { timeout: 1 }
      )
    if (result.sent > 0) {
      logger.info({ event: "campaigns.turn", campaign_id: result.campaign_id, sent: result.sent })
    }
  } catch (error) {
    if (isLockBusy(error)) {
      return
    }
    logger.warn({ event: "campaigns.dispatch_failed", err: errorSummary(error) })
  }
}

export const config = {
  name: "campaign-dispatch",
  schedule: "* * * * *",
}
