import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CAMPAIGNS_MODULE } from "../../../../../modules/campaigns"
import { pauseCampaignWorkflow } from "../../../../../workflows/campaigns/lifecycle"
import { campaignOf } from "../../../../../workflows/campaigns/save"
import { campaignView } from "../../view"

/** POST /admin/bulk-messages/:id/pause: staff stop a sending campaign; what went stays sent. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  await pauseCampaignWorkflow(req.scope).run({ input: { id } })
  res.json({ campaign: campaignView(await campaignOf(req.scope.resolve(CAMPAIGNS_MODULE), id)) })
}
