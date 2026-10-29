import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { startGoogleConnectWorkflow } from "../../../../workflows/google/connect"

/** POST /admin/google/connect: Google's consent screen to send the staff member to (F10 M13). */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await startGoogleConnectWorkflow(req.scope).run({
    input: { user_id: req.auth_context.actor_id },
  })
  res.json({ url: result.url })
}
