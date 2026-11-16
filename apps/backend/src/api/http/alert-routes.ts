import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminGetAlerts, AdminPostAlertsRead } from "../admin/alerts/validators"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import { requireUserActor } from "./actor"

/**
 * The panel's bell and its page (adr/0020): the shop's alerts for the
 * person asking, and what they have read. For people only: what is read
 * is a staff member's own.
 */
export const ALERT_ROUTES = [
  {
    matcher: "/admin/alerts",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetAlerts, {})],
  },
  // The bell: no parameters, so nothing asked can change what it holds
  {
    matcher: "/admin/alerts/bell",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetDashboardNoQuery, {})],
  },
  {
    matcher: "/admin/alerts/read",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostAlertsRead)],
  },
]
