import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aiServicesView } from "../../../../workflows/ai/services-view"

/**
 * GET /admin/ai/services (adr/0071 §11): the AI services, their states,
 * each task's usable services and the remembered choice. Every role reads
 * it, so the panel knows whether to show the button; no key leaves.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await aiServicesView(req.scope, req.auth_context.actor_id))
}
