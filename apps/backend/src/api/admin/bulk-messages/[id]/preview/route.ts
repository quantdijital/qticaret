import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { campaignPreview } from "../../../../../workflows/campaigns/preview"
import type { AdminGetCampaignPreviewType } from "../../validators"

/**
 * GET /admin/bulk-messages/:id/preview?channel=email|sms (adr/0050 §10):
 * the campaign rendered as it would go, for the asking staff member as its
 * sample recipient; its way out is a dead link. `{ subject, preheader,
 * html }` for an e-mail, `{ text, parts }` for a text. Never cached.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetCampaignPreviewType>,
  res: MedusaResponse
): Promise<void> {
  const { channel } = req.validatedQuery as unknown as AdminGetCampaignPreviewType
  const preview = await campaignPreview(req.scope, {
    id: req.params["id"] ?? "",
    user_id: req.auth_context.actor_id,
    channel,
  })
  res.setHeader("Cache-Control", "no-store")
  res.json(preview)
}
