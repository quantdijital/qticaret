import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { startGoogleConnectWorkflow } from "../../../../../workflows/google/connect"

/**
 * POST /admin/google/reviews/connect (adr/0058): Google's consent screen
 * asking Business Profile's scope on top of what the shop allowed before;
 * back from it, the panel's Google reviews.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await startGoogleConnectWorkflow(req.scope).run({
    input: { user_id: req.auth_context.actor_id, purpose: "reviews" },
  })
  res.json({ url: result.url })
}
