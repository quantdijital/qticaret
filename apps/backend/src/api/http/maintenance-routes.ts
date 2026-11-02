import { validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/**
 * Maintenance mode's bypass link (adr/0053). Turning the shop dark is a
 * settings write (`/admin/platform-settings/maintenance`, the owner's).
 */
export const MAINTENANCE_ROUTES = [
  // For people: a link past the maintenance page; no body at all
  {
    matcher: "/admin/maintenance/bypass",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(z.object({}).strict())],
  },
  // The storefront checking a visitor's link; a guess finds nothing
  {
    matcher: "/store/maintenance/bypass/:token",
    methods: ["GET" as const],
    middlewares: [rateLimit(() => RATE_LIMIT_PROFILES.maintenance_bypass)],
  },
]
