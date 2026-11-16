import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminGetAlerts, AdminPostAlertsRead } from "../admin/alerts/validators"
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
  {
    matcher: "/admin/alerts/read",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostAlertsRead)],
  },
]
