import { validateAndTransformBody } from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import {
  AdminPostStorefrontDesign,
  AdminPostStorefrontDesignApply,
  AdminPostStorefrontDesignUpdate,
} from "../admin/storefront-designs/validators"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

const perStaff = {
  identity: (req: unknown) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
}

const written = [
  requireUserActor,
  rateLimit(() => RATE_LIMIT_PROFILES.storefront_design_write, perStaff),
]

/**
 * The saved looks (adr/0064, Ek 2026-11-17): people only, never a key;
 * rate limited per staff member. Which roles may read or write is
 * the role layer's (the owner's alone, 2026-11-23).
 */
export const STOREFRONT_DESIGN_ROUTES = [
  {
    matcher: "/admin/storefront-designs",
    methods: ["POST" as const],
    middlewares: [...written, validateAndTransformBody(AdminPostStorefrontDesign)],
  },
  {
    matcher: "/admin/storefront-designs/:id",
    methods: ["POST" as const],
    middlewares: [...written, validateAndTransformBody(AdminPostStorefrontDesignUpdate)],
  },
  {
    matcher: "/admin/storefront-designs/:id",
    methods: ["DELETE" as const],
    middlewares: written,
  },
  {
    matcher: "/admin/storefront-designs/:id/apply",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      rateLimit(() => RATE_LIMIT_PROFILES.storefront_design_apply, perStaff),
      validateAndTransformBody(AdminPostStorefrontDesignApply),
    ],
  },
]
