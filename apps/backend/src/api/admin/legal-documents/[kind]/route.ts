import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { legalKind } from "../../../../workflows/legal/read"
import { kindOf } from "../kind"

/** GET /admin/legal-documents/:kind (F13.1): the published text, the draft, every version. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ document: await legalKind(req.scope, kindOf(req)) })
}
