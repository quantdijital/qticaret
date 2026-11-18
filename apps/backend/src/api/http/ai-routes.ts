import type { AuthenticatedMedusaRequest, MedusaRequest } from "@medusajs/framework/http"
import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { AdminGetAiUsage, AdminPostAiSuggestion } from "../admin/ai/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/**
 * adr/0071 §9, §11: the AI core's routes are for signed-in staff only (an
 * API key reaches none), each ask within a budget per staff member and
 * per address; who may do what is `permission-rules.ts`, and the task's
 * own roles are checked again in the workflow.
 */
const byStaff = {
  identity: (req: MedusaRequest) => (req as AuthenticatedMedusaRequest).auth_context.actor_id,
}
/** Pictures asked about (Aşama 4): image work's narrower budget on top of the text one. */
const mediaBudget = rateLimit(
  (req) =>
    (req.body as { entity_type?: unknown } | undefined)?.entity_type === "media"
      ? RATE_LIMIT_PROFILES.ai_media
      : null,
  byStaff
)

export const AI_ROUTES = [
  {
    matcher: "/admin/ai/services",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/ai/usage",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetAiUsage, {})],
  },
  {
    matcher: "/admin/ai/suggestions",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      rateLimit(() => RATE_LIMIT_PROFILES.ai_text, byStaff),
      mediaBudget,
      validateAndTransformBody(AdminPostAiSuggestion),
    ],
  },
  ...["/admin/ai/suggestions/:id/accept", "/admin/ai/suggestions/:id/dismiss"].map((matcher) => ({
    matcher,
    methods: ["POST" as const],
    middlewares: [requireUserActor],
  })),
]
