import {
  authenticate,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import {
  AdminGetReturnRequests,
  AdminPostReturnApprove,
  AdminPostReturnReceive,
  AdminPostReturnRefund,
  AdminPostReturnReject,
  StorePostReturnRequest,
} from "../admin/return-requests/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

const customer = authenticate("customer", ["session", "bearer"])

/**
 * F7.9 (adr/0032): a signed-in shopper asks to return lines of their own
 * order (a small budget each); staff decide, receive and refund.
 */
export const RETURN_ROUTES = [
  {
    matcher: "/store/orders/:id/returns",
    methods: ["GET" as const],
    middlewares: [customer],
  },
  {
    matcher: "/store/orders/:id/returns",
    methods: ["POST" as const],
    middlewares: [
      customer,
      rateLimit(() => RATE_LIMIT_PROFILES.return_request, {
        identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
      }),
      validateAndTransformBody(StorePostReturnRequest),
    ],
  },
  {
    matcher: "/admin/return-requests",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetReturnRequests, {})],
  },
  {
    matcher: "/admin/return-requests/:id/approve",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostReturnApprove)],
  },
  {
    matcher: "/admin/return-requests/:id/reject",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostReturnReject)],
  },
  {
    matcher: "/admin/return-requests/:id/receive",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostReturnReceive)],
  },
  {
    matcher: "/admin/return-requests/:id/refund",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostReturnRefund)],
  },
  {
    matcher: "/admin/return-requests/:id/label",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
]
