import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { pruneCampaignRecipientsWorkflow } from "../workflows/campaigns/jobs"

/** Who a finished campaign went to goes after 90 days; its counts stay (adr/0050 §8). */
export default async function campaignRecipientsRetention(container: MedusaContainer) {
  const { result } = await pruneCampaignRecipientsWorkflow(container).run({ input: {} })
  if (result.removed > 0) {
    logger.info({ event: "campaigns.recipients_pruned", removed: result.removed })
  }
}

export const config = {
  name: "campaign-recipients-retention",
  schedule: "40 3 * * *",
}
