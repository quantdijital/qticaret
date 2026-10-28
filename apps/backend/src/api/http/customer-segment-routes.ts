import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { validateAndTransformBody } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import {
  AdminPostCustomerSegment,
  AdminUpdateCustomerSegment,
} from "../admin/customer-segments/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

// Filling a segment reads every customer and order: a small budget per staff member
const perStaff = () =>
  rateLimit(() => RATE_LIMIT_PROFILES.bulk_ship, {
    identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
  })

/** F10.3 (adr/0037 §6): customer segments by rules, staff only. */
export const CUSTOMER_SEGMENT_ROUTES = [
  {
    matcher: "/admin/customer-segments",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/customer-segments",
    methods: ["POST" as const],
    middlewares: [requireUserActor, perStaff(), validateAndTransformBody(AdminPostCustomerSegment)],
  },
  {
    matcher: "/admin/customer-segments/:id",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      perStaff(),
      validateAndTransformBody(AdminUpdateCustomerSegment),
    ],
  },
  {
    matcher: "/admin/customer-segments/:id",
    methods: ["DELETE" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/customer-segments/:id/refresh",
    methods: ["POST" as const],
    middlewares: [requireUserActor, perStaff()],
  },
]
