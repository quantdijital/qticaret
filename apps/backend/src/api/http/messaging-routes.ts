import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import {
  AdminGetSuppressions,
  AdminPostSuppression,
} from "../admin/messaging/suppressions/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/** F9 (adr/0036): Resend's signed delivery reports and the suppression list. */
export const MESSAGING_ROUTES = [
  // The signature covers the exact bytes Resend sent
  {
    matcher: "/hooks/resend",
    methods: ["POST" as const],
    bodyParser: { preserveRawBody: true },
    middlewares: [rateLimit(() => RATE_LIMIT_PROFILES.webhook)],
  },
  {
    matcher: "/admin/messaging/suppressions",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetSuppressions, {})],
  },
  {
    matcher: "/admin/messaging/suppressions",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostSuppression)],
  },
  {
    matcher: "/admin/messaging/suppressions/:id",
    methods: ["DELETE" as const],
    middlewares: [requireUserActor],
  },
]
