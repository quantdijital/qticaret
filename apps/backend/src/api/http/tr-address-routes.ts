import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { AdminGetTrAddressStatus, AdminPostTrAddressSync } from "../admin/tr-address/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

// A sync calls TürkiyeAPI: the provider calls' small budget per staff member
const syncCalls = rateLimit(() => RATE_LIMIT_PROFILES.provider_check, {
  identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
})

/**
 * adr/0008 Ek 2026-11-04: the address reference data's state, read by
 * every role, and a sync from TürkiyeAPI started by the owner
 * (lib/staff/permissions.ts), a person only, never an API key.
 */
export const TR_ADDRESS_ROUTES = [
  {
    matcher: "/admin/tr-address/status",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetTrAddressStatus, {})],
  },
  {
    matcher: "/admin/tr-address/sync",
    methods: ["POST" as const],
    middlewares: [requireUserActor, syncCalls, validateAndTransformBody(AdminPostTrAddressSync)],
  },
]
