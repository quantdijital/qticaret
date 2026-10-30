import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  discardLegalDraftWorkflow,
  saveLegalDraftWorkflow,
} from "../../../../../workflows/legal/documents"
import { kindOf } from "../../kind"
import type { AdminPostLegalDraftType } from "../../validators"

/** POST /admin/legal-documents/:kind/draft (F13.1): the draft saved, its tokens checked. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostLegalDraftType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await saveLegalDraftWorkflow(req.scope).run({
    input: {
      kind: kindOf(req),
      title: req.validatedBody.title,
      body: req.validatedBody.body,
      actor_id: req.auth_context.actor_id || null,
    },
  })
  res.json({ draft: { id: result.id, version: result.version } })
}

/** DELETE /admin/legal-documents/:kind/draft: the draft dropped; the published text stays. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await discardLegalDraftWorkflow(req.scope).run({
    input: { kind: kindOf(req) },
  })
  res.json({ id: result.id, object: "legal_document", deleted: true })
}
