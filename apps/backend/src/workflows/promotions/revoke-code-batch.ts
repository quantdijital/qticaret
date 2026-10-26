import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { updateCampaignsWorkflow } from "@medusajs/medusa/core-flows"
import { batchOf } from "./code-batch-reads"

export interface RevokeCodeBatchInput {
  template_id: string
  campaign_id: string
}

/** The batch is the template's; read only. */
const batchOfTemplateStep = createStep(
  "promotion-code-batch-of-template",
  async (input: RevokeCodeBatchInput, { container }) =>
    new StepResponse(await batchOf(container, input.template_id, input.campaign_id))
)

/**
 * A batch's codes stopped (F4.6): its campaign ends now, so none of them
 * applies any more, used or not. A batch not yet begun begins and ends now.
 * Medusa's campaign update puts the days back if a later step fails.
 */
export const revokeCodeBatchWorkflow = createWorkflow(
  "promotion-code-batch-revoke",
  (input: RevokeCodeBatchInput) => {
    const batch = batchOfTemplateStep(input)
    const change = transform({ batch }, ({ batch }) => {
      const now = new Date()
      const notBegun = batch.starts_at !== null && new Date(batch.starts_at) > now
      return {
        campaignsData: [{ id: batch.id, ends_at: now, ...(notBegun ? { starts_at: now } : {}) }],
      }
    })
    updateCampaignsWorkflow.runAsStep({ input: change })
    return new WorkflowResponse(
      transform({ change }, ({ change }) => ({
        campaign_id: change.campaignsData[0]?.id ?? "",
        // Workflow data is stored as JSON between steps: the day comes back as text
        ends_at: change.campaignsData[0]
          ? new Date(change.campaignsData[0].ends_at).toISOString()
          : null,
      }))
    )
  }
)
