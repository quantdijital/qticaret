import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
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
import { optionalCustomer, orderAccess, orderActor } from "./order-access"
import { rateLimit } from "./rate-limit"

/**
 * F7.9 (adr/0032): a shopper asks to return lines of their own order (a
 * small budget each), signed in or with the order's key from its e-mail
 * (adr/0037 §2); staff decide, receive and refund.
 */
export const RETURN_ROUTES = [
  // F18: the order page's parcels and their tracking, the same access as its returns
  {
    matcher: "/store/orders/:id/shipments",
    methods: ["GET" as const],
    middlewares: [optionalCustomer, orderAccess],
  },
  {
    matcher: "/store/orders/:id/returns",
    methods: ["GET" as const],
    middlewares: [optionalCustomer, orderAccess],
  },
  // F18: what the order page may ask back, before the form is sent (adr/0025 2026-11-03)
  {
    matcher: "/store/orders/:id/returnable",
    methods: ["GET" as const],
    middlewares: [optionalCustomer, orderAccess],
  },
  {
    matcher: "/store/orders/:id/returns",
    methods: ["POST" as const],
    middlewares: [
      optionalCustomer,
      orderAccess,
      rateLimit(() => RATE_LIMIT_PROFILES.return_request, { identity: orderActor }),
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
  // F12.3: staff open one for the shopper who called, by the shopper's rules
  {
    matcher: "/admin/orders/:id/return-requests",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(StorePostReturnRequest)],
  },
  {
    matcher: "/admin/orders/:id/returnable",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/return-requests/:id/label",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
]
