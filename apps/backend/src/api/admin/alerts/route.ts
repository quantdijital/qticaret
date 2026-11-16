import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listAlerts } from "../../../workflows/notifications/list"
import { recordSensitiveRead } from "../../http/audit/sensitive-read"
import type { AdminGetAlertsType } from "./validators"

/**
 * `GET /admin/alerts` (adr/0020): the Bildirimler page, the shop's alerts
 * for the person asking, newest first, each marked read or not by them,
 * with their unread count. The kinds their role does not get are left out
 * (`lib/notifications/access.ts`). A page that names a wholesaler is a
 * recorded read (adr/0011), decided by what the answer holds, never by
 * what was asked: no parameter leaves a name unrecorded. The bell has its
 * own route without names (`./bell`).
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetAlertsType>,
  res: MedusaResponse
): Promise<void> {
  const query = req.validatedQuery
  const { named, ...page } = await listAlerts(req.scope, {
    userId: req.auth_context.actor_id,
    state: query.state,
    group: query.group ?? null,
    offset: query.offset,
    limit: query.limit,
  })
  if (named && !(await recordSensitiveRead(req, res, "notification", true))) {
    return
  }
  res.json(page)
}
