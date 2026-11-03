import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CAMPAIGNS_MODULE } from "../../../../../modules/campaigns"
import type CampaignsModuleService from "../../../../../modules/campaigns/service"
import { campaignOf, copyCampaignWorkflow } from "../../../../../workflows/campaigns/save"
import type { AdminCopyCampaignType } from "../../validators"
import { campaignView } from "../../view"

/** POST /admin/bulk-messages/:id/copy ("Kopyala", adr/0050 §2): a new draft from any campaign. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminCopyCampaignType>,
  res: MedusaResponse
): Promise<void> {
  const service = req.scope.resolve<CampaignsModuleService>(CAMPAIGNS_MODULE)
  const source = await campaignOf(service, req.params["id"] ?? "")
  const { result } = await copyCampaignWorkflow(req.scope).run({
    input: {
      id: source.id,
      name: req.validatedBody.name ?? source.name,
      created_by: req.auth_context.actor_id || null,
    },
  })
  res.status(201).json({ campaign: campaignView(await campaignOf(service, result.id)) })
}
