import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { AdminGetContentDrafts, AdminPostContentDraft } from "../admin/content-drafts/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/** F10.13 (adr/0005): drafts asked for and decided on by staff only, each ask within a budget. */
export const CONTENT_DRAFT_ROUTES = [
  {
    matcher: "/admin/content-drafts",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetContentDrafts, {})],
  },
  {
    matcher: "/admin/content-drafts",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      rateLimit(() => RATE_LIMIT_PROFILES.content_draft, {
        identity: (req) => (req as AuthenticatedMedusaRequest).auth_context.actor_id,
      }),
      validateAndTransformBody(AdminPostContentDraft),
    ],
  },
  ...["/admin/content-drafts/:id/approve", "/admin/content-drafts/:id/reject"].map((matcher) => ({
    matcher,
    methods: ["POST" as const],
    middlewares: [requireUserActor],
  })),
]
