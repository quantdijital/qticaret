import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CAMPAIGNS_MODULE } from "../../../modules/campaigns"
import type CampaignsModuleService from "../../../modules/campaigns/service"
import { createCampaignWorkflow } from "../../../workflows/campaigns/save"
import type { AdminGetCampaignsType, AdminPostCampaignType } from "./validators"
import { campaignSummary, campaignView } from "./view"

/** GET /admin/bulk-messages (adr/0050 §10): the bulk messages, newest first; by status, by channel. */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetCampaignsType>,
  res: MedusaResponse
): Promise<void> {
  const { status, channel, limit, offset } = req.validatedQuery as unknown as AdminGetCampaignsType
  const filters = { ...(status ? { status } : {}), ...(channel ? { channel } : {}) }
  const [campaigns, count] = await req.scope
    .resolve<CampaignsModuleService>(CAMPAIGNS_MODULE)
    .listAndCountBulkMessages(filters, {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    })
  res.json({ campaigns: campaigns.map(campaignSummary), count, limit, offset })
}

/** POST /admin/bulk-messages: a new draft. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostCampaignType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody
  const { result } = await createCampaignWorkflow(req.scope).run({
    input: {
      name: body.name,
      channel: body.channel,
      audience: body.audience,
      subject: body.subject ?? null,
      preheader: body.preheader ?? null,
      body: body.body ?? null,
      sms_text: body.sms_text ?? null,
      created_by: req.auth_context.actor_id || null,
    },
  })
  const campaign = await req.scope
    .resolve<CampaignsModuleService>(CAMPAIGNS_MODULE)
    .retrieveBulkMessage(result.id)
  res.status(201).json({ campaign: campaignView(campaign) })
}
