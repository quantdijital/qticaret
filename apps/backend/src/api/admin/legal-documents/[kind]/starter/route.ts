import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { starterOf, tokensFor } from "../../../../../lib/legal"
import { kindOf } from "../../kind"

/**
 * GET /admin/legal-documents/:kind/starter (F13.7): the kind's starting
 * draft, marked for a lawyer to check, and the tokens it may use.
 */
export function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): void {
  const kind = kindOf(req)
  res.json({ starter: starterOf(kind), tokens: tokensFor(kind) })
}
