import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resetLegalDraftWorkflow } from "../../../../../../workflows/legal/documents"
import { fullVersionOf } from "../../../../../../workflows/legal/read"
import { kindOf } from "../../../kind"
import type { AdminPostLegalDraftResetType } from "../../../validators"

/**
 * POST /admin/legal-documents/:kind/draft/reset: the draft started again
 * from the platform's starter (its draft note with it) or a copy of the
 * published text; 409 `legal.nothing_published` when there is none to copy.
 * The published text stays in force.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostLegalDraftResetType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await resetLegalDraftWorkflow(req.scope).run({
    input: {
      kind: kindOf(req),
      source: req.validatedBody.source,
      actor_id: req.auth_context.actor_id || null,
    },
  })
  res.json({ draft: fullVersionOf(result) })
}
