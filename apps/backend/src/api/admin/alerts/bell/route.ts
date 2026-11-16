import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { bellAlerts } from "../../../../workflows/notifications/list"

/**
 * `GET /admin/alerts/bell` (adr/0020): the bell's count and its newest
 * alerts, polled every minute. No one's personal data is in it (a
 * wholesaler's order without the company), so it is no recorded read and
 * answers whatever the audit log's state; it takes no parameters.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await bellAlerts(req.scope, req.auth_context.actor_id))
}
