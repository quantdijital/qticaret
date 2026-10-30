import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { checkParasutWorkflow } from "../../../../../workflows/einvoice/parasut-connection"

/** POST /admin/einvoice/parasut/check: one read of the company with a live token. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await checkParasutWorkflow(req.scope).run()
  res.json({ check: result })
}
