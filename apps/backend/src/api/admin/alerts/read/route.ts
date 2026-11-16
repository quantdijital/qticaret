import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { markAlertsReadWorkflow } from "../../../../workflows/notifications/mark-read"
import type { AdminPostAlertsReadType } from "../validators"

/** `POST /admin/alerts/read`: some alerts, or all, read by the person asking; their own state only. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostAlertsReadType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody
  await markAlertsReadWorkflow(req.scope).run({
    input: { user_id: req.auth_context.actor_id, ids: body.ids, all: body.all },
  })
  res.json({ ok: true })
}
