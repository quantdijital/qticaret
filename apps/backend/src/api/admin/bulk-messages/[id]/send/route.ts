import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CAMPAIGNS_MODULE } from "../../../../../modules/campaigns"
import { sendCampaignWorkflow } from "../../../../../workflows/campaigns/lifecycle"
import { campaignOf } from "../../../../../workflows/campaigns/save"
import { campaignView } from "../../view"

/**
 * POST /admin/bulk-messages/:id/send ("Gönder", adr/0050 §7): the person
 * proves themselves again (CAMPAIGN_ROUTES); the job fixes the list and
 * sends within the minute.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  await sendCampaignWorkflow(req.scope).run({
    input: { id, user_id: req.auth_context.actor_id || null },
  })
  res.json({ campaign: campaignView(await campaignOf(req.scope.resolve(CAMPAIGNS_MODULE), id)) })
}
