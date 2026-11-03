import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CAMPAIGNS_MODULE } from "../../../../modules/campaigns"
import type CampaignsModuleService from "../../../../modules/campaigns/service"
import {
  campaignOf,
  deleteCampaignWorkflow,
  updateCampaignWorkflow,
} from "../../../../workflows/campaigns/save"
import type { CampaignChanges } from "../../../../workflows/campaigns/save"
import type { AdminUpdateCampaignType } from "../validators"
import { campaignView } from "../view"

const serviceOf = (req: AuthenticatedMedusaRequest) =>
  req.scope.resolve<CampaignsModuleService>(CAMPAIGNS_MODULE)

/** GET /admin/bulk-messages/:id: the campaign for its editor; no recipient in it. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ campaign: campaignView(await campaignOf(serviceOf(req), req.params["id"] ?? "")) })
}

/** POST /admin/bulk-messages/:id: a draft changed; a campaign past its draft is locked. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateCampaignType>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params["id"] ?? ""
  // Only what was sent: a field left out keeps its value
  const changes = Object.fromEntries(
    Object.entries(req.validatedBody).filter(([, value]) => value !== undefined)
  ) as CampaignChanges
  await updateCampaignWorkflow(req.scope).run({ input: { id, changes } })
  res.json({ campaign: campaignView(await campaignOf(serviceOf(req), id)) })
}

/** DELETE /admin/bulk-messages/:id: a draft removed. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await deleteCampaignWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "" },
  })
  res.json({ id: result.id, deleted: true })
}
