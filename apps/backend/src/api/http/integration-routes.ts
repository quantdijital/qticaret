import { validateAndTransformBody } from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import {
  AdminPostCredentials,
  AdminPostCredentialsCheck,
} from "../admin/integrations/credentials/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/**
 * F5 (adr/0027): the shop's provider accounts. Staff only until roles
 * arrive (F12): an integration key cannot replace the payment account,
 * nor have the server test it. Saving and testing call the provider, so
 * each has a small budget, per address and per staff member.
 */
const providerCalls = rateLimit(() => RATE_LIMIT_PROFILES.provider_check, {
  identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
})

export const INTEGRATION_ROUTES = [
  // It tests the stored PayTR account with the shop's secrets
  {
    matcher: "/admin/integrations/health",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/integrations/credentials",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/integrations/credentials/:provider",
    methods: ["POST" as const],
    middlewares: [requireUserActor, providerCalls, validateAndTransformBody(AdminPostCredentials)],
  },
  {
    matcher: "/admin/integrations/credentials/:provider",
    methods: ["DELETE" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/integrations/credentials/:provider/check",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      providerCalls,
      validateAndTransformBody(AdminPostCredentialsCheck),
    ],
  },
]
