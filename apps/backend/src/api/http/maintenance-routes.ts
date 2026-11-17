import { validateAndTransformBody } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { requireUserActor } from "./actor"
import { refuseWritesInMaintenance } from "./maintenance-guard"
import { rateLimit } from "./rate-limit"

/**
 * Maintenance mode's bypass link (adr/0053). Turning the shop dark is a
 * settings write (`/admin/platform-settings/maintenance`, the owner's).
 * The Store API's writes are closed while dark by `refuseWritesInMaintenance`
 * in the `/store/*` chain (middlewares.ts); a shopper's registration here.
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
  // adr/0053 Ek 2026-11-17: no new shopper account while dark. A wildcard
  // without `methods`, so it sorts before the registration's own checks (mail
  // domain, password rule) and Medusa's route; the guard closes only a POST
  // to `/auth/customer/:provider/register`: sign-in, resets and every staff
  // route (`/auth/user/*`) pass untouched
  {
    matcher: "/auth/*",
    middlewares: [refuseWritesInMaintenance],
  },
]
