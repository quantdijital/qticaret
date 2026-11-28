import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { supportGrantIdSchema } from "@qticaret/types/control-plane"
import { endSupportSessionWorkflow } from "../../../../../../workflows/support-access"
import { factsOf } from "../../../../../http/support-guard"

/**
 * POST /admin/support-access/sessions/:grant_id/end (Karar 6; the
 * owner's alone): an open support session ended now. Its next request is
 * refused with 401 and the browser's session destroyed. An unknown or
 * already ended session answers 404.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const grantId = supportGrantIdSchema.safeParse(req.params["grant_id"])
  if (!grantId.success) {
    res.status(404).json({ type: "not_found", message: "support.session_not_found" })
    return
  }
  const { result } = await endSupportSessionWorkflow(req.scope).run({
    input: {
      grant_id: grantId.data,
      reason: "ended_by_owner",
      actor_id: req.auth_context.actor_id,
      facts: factsOf(req),
    },
  })
  if (!result) {
    res.status(404).json({ type: "not_found", message: "support.session_not_found" })
    return
  }
  res.json({ session: { grant_id: result.grant_id, ended_at: result.ended_at } })
}
