import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CAMPAIGNS_MODULE } from "../../../../../modules/campaigns"
import { scheduleCampaignWorkflow } from "../../../../../workflows/campaigns/lifecycle"
import { campaignOf } from "../../../../../workflows/campaigns/save"
import type { AdminScheduleCampaignType } from "../../validators"
import { campaignView } from "../../view"

/** POST /admin/bulk-messages/:id/schedule ("Zamanla", adr/0050 §7): proven again, sent at the time. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminScheduleCampaignType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  await scheduleCampaignWorkflow(req.scope).run({
    input: {
      id,
      scheduled_at: new Date(req.validatedBody.scheduled_at),
      user_id: req.auth_context.actor_id || null,
    },
  })
  res.json({ campaign: campaignView(await campaignOf(req.scope.resolve(CAMPAIGNS_MODULE), id)) })
}
