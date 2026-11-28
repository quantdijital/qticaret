import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import {
  AdminGetSampleCatalog,
  AdminPostSampleCatalogLoad,
  AdminPostSampleCatalogRemove,
} from "../admin/sample-catalog/validators"
import type { RateLimitProfile } from "../../lib/security/rate-limit"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"
import { SAMPLE_METADATA_ROUTES } from "./sample-metadata"

/** A load uploads a set's pictures and makes dozens of records; a removal is as heavy. */
const SAMPLE_WRITE: RateLimitProfile = {
  name: "sample_catalog_write",
  perIdentityAnyIp: { max: 30, windowMs: 60 * 60 * 1000 },
}

/**
 * The card's read (security review 2026-11-28, D5): whole (every product
 * with its orders and places) when a person opens the card, or the load
 * job alone (`?job=1`), which the panel polls every two seconds while a
 * load runs. Past these a script is at it.
 */
const SAMPLE_READ: RateLimitProfile = {
  name: "sample_catalog_read",
  perIdentityAnyIp: { max: 30, windowMs: 60 * 1000 },
}
const SAMPLE_POLL: RateLimitProfile = {
  name: "sample_catalog_poll",
  perIdentityAnyIp: { max: 300, windowMs: 60 * 1000 },
}

const readProfile = (req: { query?: unknown }): RateLimitProfile =>
  (req.query as { job?: unknown } | undefined)?.job === undefined ? SAMPLE_READ : SAMPLE_POLL

const byActor = (req: unknown) =>
  (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id

const writes = [requireUserActor, rateLimit(() => SAMPLE_WRITE, { identity: byActor })]

/**
 * The sector pack's sample catalogue (owner, 2026-11-28): read, loaded,
 * removed. People only; by role the owner and admins (the role table's
 * `PRIVATE` list keeps the others out).
 */
export const SAMPLE_CATALOG_ROUTES = [
  {
    matcher: "/admin/sample-catalog",
    methods: ["GET" as const],
    middlewares: [
      requireUserActor,
      rateLimit(readProfile, { identity: byActor }),
      validateAndTransformQuery(AdminGetSampleCatalog, {}),
    ],
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
  // D1: the sample marks are the server's on Medusa's product and category routes
  ...SAMPLE_METADATA_ROUTES,
]
