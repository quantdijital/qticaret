import { validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import { requireUserActor } from "./actor"

/**
 * adr/0061 §5.6, Ek C14: the shop's package, limits, use and billing, for
 * Settings > Abonelik and the limit notices. People only; by role the
 * owner and admins (the role table's `PRIVATE` list keeps the others out:
 * the billing summary is the shop's business with the platform).
 */
export const PLAN_ROUTES = [
  {
    matcher: "/admin/plan",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetDashboardNoQuery, {})],
  },
  // Ek C20: the shop's payments to the platform, the same people
  {
    matcher: "/admin/plan/payments",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetDashboardNoQuery, {})],
  },
]
