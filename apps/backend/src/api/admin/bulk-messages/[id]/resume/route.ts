import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CAMPAIGNS_MODULE } from "../../../../../modules/campaigns"
import { resumeCampaignWorkflow } from "../../../../../workflows/campaigns/lifecycle"
import { campaignOf } from "../../../../../workflows/campaigns/save"
import { campaignView } from "../../view"

/** POST /admin/bulk-messages/:id/resume: a paused campaign goes on, whatever stopped it. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  await resumeCampaignWorkflow(req.scope).run({ input: { id } })
  res.json({ campaign: campaignView(await campaignOf(req.scope.resolve(CAMPAIGNS_MODULE), id)) })
}
