import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { capabilitiesOf } from "../../../lib/staff/permissions"
import { STAFF_ROLES_MODULE } from "../../../modules/staff-roles"
import type StaffRolesModuleService from "../../../modules/staff-roles/service"
import { listAlerts } from "../../../workflows/notifications/list"
import type { AdminGetAlertsType } from "./validators"

/**
 * `GET /admin/alerts` (adr/0020): the shop's alerts for the person asking,
 * newest first, each marked read or not by them, with their unread count
 * for the bell. A wholesaler's order is left out for a role that does not
 * see wholesalers (ADR-0068 §9).
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetAlertsType>,
  res: MedusaResponse
): Promise<void> {
  const userId = req.auth_context.actor_id
  const role = await req.scope.resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE).roleOf(userId)
  const query = req.validatedQuery
  res.json(
    await listAlerts(req.scope, {
      userId,
      seesWholesale: capabilitiesOf(role).wholesale,
      state: query.state,
      group: query.group ?? null,
      offset: query.offset,
      limit: query.limit,
    })
  )
}
