import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SMS_MAX_PARTS } from "../../../../../lib/campaigns/sms"
import type { CampaignSource } from "../../../../../lib/campaigns/types"
import { CAMPAIGNS_MODULE } from "../../../../../modules/campaigns"
import { resolveAudience } from "../../../../../workflows/campaigns/audience"
import { smsPartsOf } from "../../../../../workflows/campaigns/content"
import { quotaLeft } from "../../../../../workflows/campaigns/quota"
import { campaignOf } from "../../../../../workflows/campaigns/save"
import type { AdminPreviewCampaignAudienceType } from "../../validators"

/**
 * POST /admin/bulk-messages/:id/audience-preview (adr/0050 §3): how many the
 * campaign would reach now, and why the rest would not; with what today's
 * quota sends today and what waits for the next day. Counts only: no
 * address, no name. Nothing is fixed until it is sent.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPreviewCampaignAudienceType>,
  res: MedusaResponse
): Promise<void> {
  const campaign = await campaignOf(req.scope.resolve(CAMPAIGNS_MODULE), req.params["id"] ?? "")
  const channel = req.validatedBody.channel ?? campaign.channel
  const sorted = await resolveAudience(req.scope, {
    channel,
    sources: (req.validatedBody.audience ?? campaign.audience) as unknown as CampaignSource[],
    campaign_id: campaign.id,
  })
  const quota = await quotaLeft(req.scope, channel, new Date())
  const eligible = sorted.eligible.length
  const today = Math.min(eligible, quota.left)
  res.setHeader("Cache-Control", "no-store")
  res.json({
    channel,
    audience: sorted.audience,
    eligible,
    excluded: sorted.excluded,
    quota: { limit: quota.limit, left: quota.left, today, later: eligible - today },
    sms:
      channel === "sms" && campaign.sms_text
        ? { parts: await smsPartsOf(req.scope, campaign.sms_text), max_parts: SMS_MAX_PARTS }
        : null,
  })
}
