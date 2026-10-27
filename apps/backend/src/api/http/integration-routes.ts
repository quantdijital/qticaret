import { validateAndTransformBody } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { AdminPostCredentials } from "../admin/integrations/credentials/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/**
 * F5 (adr/0027): the shop's provider accounts. Staff only until roles
 * arrive (F12): an integration key cannot replace the payment account.
 * Saving and testing call the provider, so each has a small budget.
 */
const providerCalls = rateLimit(() => RATE_LIMIT_PROFILES.provider_check)

export const INTEGRATION_ROUTES = [
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
    middlewares: [requireUserActor, providerCalls],
  },
]
