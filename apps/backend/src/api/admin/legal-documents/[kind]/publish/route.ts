import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { publishLegalDraftWorkflow } from "../../../../../workflows/legal/documents"
import { kindOf } from "../../kind"

/**
 * POST /admin/legal-documents/:kind/publish (F13.1): the draft becomes the
 * published text, the one before it retires; never changed again.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await publishLegalDraftWorkflow(req.scope).run({
    input: { kind: kindOf(req), actor_id: req.auth_context.actor_id || null },
  })
  res.json({ published: { id: result.id, version: result.version, body_hash: result.body_hash } })
}
