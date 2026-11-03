import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { testSendCampaignWorkflow } from "../../../../../workflows/campaigns/test-send"

/**
 * POST /admin/bulk-messages/:id/test-send (adr/0050 §5): to the asking staff
 * member's own address only; no address is taken from the request.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await testSendCampaignWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "", user_id: req.auth_context.actor_id },
  })
  res.json({ sent: true, channel: result.channel, to: result.to })
}
