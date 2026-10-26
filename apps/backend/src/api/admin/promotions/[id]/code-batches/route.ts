import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { codeBatchesOf } from "../../../../../workflows/promotions/code-batch-reads"

/** `GET /admin/promotions/:id/code-batches` (F4.6): the promotion's batches of single-use codes. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ batches: await codeBatchesOf(req.scope, req.params["id"] ?? "") })
}
