import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readOpenSeoSuggestions } from "../../../../../workflows/ai/bulk-seo/open"

/**
 * GET /admin/ai/seo-fill/suggestions (adr/0074 §5 madde 7): the search
 * text suggestions waiting for a decision, with their page, for the
 * review dialog. Accepting one is the panel's two existing calls: the
 * page's SEO save, then `…/suggestions/:id/accept` with the candidate.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ suggestions: await readOpenSeoSuggestions(req.scope, req.auth_context.actor_id) })
}
