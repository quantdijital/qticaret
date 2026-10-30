import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { legalOverview } from "../../../workflows/legal/read"

/** GET /admin/legal-documents (F13.1): each kind's published version and draft. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ documents: await legalOverview(req.scope) })
}
