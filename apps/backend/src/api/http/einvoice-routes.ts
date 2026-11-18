import { validateAndTransformBody } from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { AdminPostParasutConnection } from "../admin/einvoice/parasut/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"
import { requireReauth } from "./reauth"

// Calls to Paraşüt from the panel: the provider checks' small budget per staff member
const parasutCalls = rateLimit(() => RATE_LIMIT_PROFILES.provider_check, {
  identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
})

/**
 * F8 (adr/0034 §5): the shop's Paraşüt connection, staff only (never an
 * API key). Connecting or forgetting it asks the owner to prove it again.
 */
export const EINVOICE_ROUTES = [
  { matcher: "/admin/einvoice*", middlewares: [requireUserActor] },
  {
    matcher: "/admin/einvoice/parasut",
    methods: ["POST" as const],
    middlewares: [
      parasutCalls,
      requireReauth(),
      validateAndTransformBody(AdminPostParasutConnection),
    ],
  },
  {
    matcher: "/admin/einvoice/parasut",
    methods: ["DELETE" as const],
    middlewares: [requireReauth()],
  },
  {
    matcher: "/admin/einvoice/parasut/check",
    methods: ["POST" as const],
    middlewares: [parasutCalls],
  },
  // adr/0072 §3: BirFatura's connection token, made or replaced by the owner proving
  // it again; the old one stops at once. No body: the server draws the token
  {
    matcher: "/admin/einvoice/birfatura/token",
    methods: ["POST" as const],
    middlewares: [requireReauth()],
  },
]
