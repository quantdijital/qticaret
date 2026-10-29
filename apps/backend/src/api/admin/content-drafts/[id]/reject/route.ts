import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { decideDraftWorkflow } from "../../../../../workflows/content/drafts"

/** POST /admin/content-drafts/:id/reject (F10.13): staff turn the draft down. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await decideDraftWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "", decision: "reject", user_id: req.auth_context.actor_id },
  })
  res.json(result)
}
