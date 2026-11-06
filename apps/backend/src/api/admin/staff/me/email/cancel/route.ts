import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cancelEmailChange } from "../../../../../../workflows/staff/email-change"

/**
 * POST /admin/staff/me/email/cancel (security review 2026-11-06): the
 * member drops their waiting address change; its link opens nothing.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ canceled: await cancelEmailChange(req.auth_context.actor_id) })
}
