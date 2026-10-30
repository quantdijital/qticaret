import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { startDataExportWorkflow } from "../../../../../workflows/legal/privacy-requests"

/**
 * POST /admin/privacy-requests/:id/export (F13.5): prepares the copy of the
 * customer's data an open export request asks for, as a private job.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await startDataExportWorkflow(req.scope).run({
    input: { request_id: req.params["id"] ?? "", requested_by: req.auth_context.actor_id },
  })
  res.json({ job: { id: result.id } })
}
