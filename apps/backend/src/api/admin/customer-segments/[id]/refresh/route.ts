import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { refreshSegmentWorkflow } from "../../../../../workflows/customers/segments"

/** POST /admin/customer-segments/:id/refresh: filled again now, not waiting for the night. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await refreshSegmentWorkflow(req.scope).run({
    input: { segment_id: req.params["id"] ?? "" },
  })
  res.json(result)
}
