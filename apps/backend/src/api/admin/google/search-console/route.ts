import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { saveSearchConsoleSiteWorkflow } from "../../../../workflows/google/search-console"
import type { AdminPostSearchConsoleSiteType } from "../validators"

/** POST /admin/google/search-console: the shop's Search Console property (F10.11). */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostSearchConsoleSiteType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await saveSearchConsoleSiteWorkflow(req.scope).run({
    input: { site: req.validatedBody.site, user_id: req.auth_context.actor_id },
  })
  res.json(result)
}
