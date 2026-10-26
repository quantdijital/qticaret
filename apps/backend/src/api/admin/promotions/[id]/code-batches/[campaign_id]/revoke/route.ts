import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { revokeCodeBatchWorkflow } from "../../../../../../../workflows/promotions/revoke-code-batch"

/**
 * `POST /admin/promotions/:id/code-batches/:campaign_id/revoke` (F4.6): a
 * batch's codes stopped, for a batch that leaked or a campaign called off.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await revokeCodeBatchWorkflow(req.scope).run({
    input: { template_id: req.params["id"] ?? "", campaign_id: req.params["campaign_id"] ?? "" },
  })
  res.json({ batch: result })
}
