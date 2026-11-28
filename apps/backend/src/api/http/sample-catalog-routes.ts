import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import {
  AdminPostSampleCatalogLoad,
  AdminPostSampleCatalogRemove,
} from "../admin/sample-catalog/validators"
import type { RateLimitProfile } from "../../lib/security/rate-limit"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/** A load uploads a set's pictures and makes dozens of records; a removal is as heavy. */
const SAMPLE_WRITE: RateLimitProfile = {
  name: "sample_catalog_write",
  perIdentityAnyIp: { max: 30, windowMs: 60 * 60 * 1000 },
}

const writes = [
  requireUserActor,
  rateLimit(() => SAMPLE_WRITE, {
    identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
  }),
]

/**
 * The sector pack's sample catalogue (owner, 2026-11-28): read, loaded,
 * removed. People only; by role the owner and admins (the role table's
 * `PRIVATE` list keeps the others out).
 */
export const SAMPLE_CATALOG_ROUTES = [
  {
    matcher: "/admin/sample-catalog",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetDashboardNoQuery, {})],
  },
  {
    matcher: "/admin/sample-catalog/load",
    methods: ["POST" as const],
    middlewares: [...writes, validateAndTransformBody(AdminPostSampleCatalogLoad)],
  },
  {
    matcher: "/admin/sample-catalog/remove",
    methods: ["POST" as const],
    middlewares: [...writes, validateAndTransformBody(AdminPostSampleCatalogRemove)],
  },
]
