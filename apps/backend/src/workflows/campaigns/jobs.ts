import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { CAMPAIGNS_MODULE } from "../../modules/campaigns"
import type CampaignsModuleService from "../../modules/campaigns/service"
import { dispatchCampaigns } from "./dispatch"
import type { DispatchInput } from "./dispatch"
import { liveCounts } from "./report"

/** How long a finished campaign keeps who it went to (adr/0050 §8); its counts stay. */
export const RECIPIENTS_KEEP_DAYS = 90

/**
 * One turn of bulk sending (adr/0050 §6). E-mails and texts gone out
 * cannot be called back: nothing to undo; a turn cut short is sent again
 * by the next without a second message (deliver()'s key).
 */
const dispatchStep = createStep(
  "campaigns-dispatch",
  async (input: DispatchInput, { container }) =>
    new StepResponse(
      await dispatchCampaigns(container, {
        ...input,
        ...(input.now ? { now: new Date(input.now) } : {}),
      })
    )
)

export const dispatchCampaignsWorkflow = createWorkflow(
  "campaigns-dispatch",
  (input: DispatchInput) => new WorkflowResponse(dispatchStep(input))
)

/**
 * Campaigns finished more than RECIPIENTS_KEEP_DAYS ago lose their
 * recipients, their final counts kept first (adr/0050 §8). Nothing to
 * undo: the counts are written before the rows go.
 */
const pruneRecipientsStep = createStep(
  "campaigns-prune-recipients",
  async (input: { now?: string }, { container }) => {
    const now = input.now ? new Date(input.now) : new Date()
    const before = new Date(now.getTime() - RECIPIENTS_KEEP_DAYS * 24 * 60 * 60 * 1000)
    const service = container.resolve<CampaignsModuleService>(CAMPAIGNS_MODULE)
    const finished = await service.listBulkMessages(
      {
        status: ["sent", "cancelled", "failed"],
        finished_at: { $lt: before },
        frozen_at: { $ne: null },
        recipients_pruned_at: null,
      },
      { take: 50 }
    )
    let removed = 0
    for (const campaign of finished) {
      const counts = await liveCounts(container, campaign)
      await service.updateBulkMessages({
        id: campaign.id,
        counts: counts as unknown as Record<string, unknown>,
        recipients_pruned_at: now,
      })
      removed += await service.pruneRecipients(campaign.id)
    }
    return new StepResponse({ removed })
  }
)

export const pruneCampaignRecipientsWorkflow = createWorkflow(
  "campaigns-prune-recipients",
  (input: { now?: string }) => new WorkflowResponse(pruneRecipientsStep(input))
)
