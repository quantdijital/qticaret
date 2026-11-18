import type { AuthenticatedMedusaRequest, MedusaRequest } from "@medusajs/framework/http"
import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { findAiTask } from "../../lib/ai/registry/tasks"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import {
  AdminGetAiSuggestions,
  AdminGetAiUsage,
  AdminPostAiSuggestion,
} from "../admin/ai/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/**
 * adr/0071 §9, §11: the AI core's routes are for signed-in staff only (an
 * API key reaches none), each ask within a budget per staff member and
 * per address; who may do what is `permission-rules.ts`, and the task's
 * own roles are checked again in the workflow.
 */
/**
 * The budget an ask spends, by its task's capability (adr/0071 §8): work on
 * an image or a video is dearer and slower than text, so it counts against
 * the narrower `ai_media`. The body is read before validation, so an
 * unknown or missing task counts as text (validation then refuses it).
 */
export function aiSuggestionProfile(req: MedusaRequest) {
  const body: unknown = req.body
  const id =
    typeof body === "object" && body !== null ? (body as { task?: unknown }).task : undefined
  const task = typeof id === "string" ? findAiTask(id) : null
  return task === null || task.capability === "text"
    ? RATE_LIMIT_PROFILES.ai_text
    : RATE_LIMIT_PROFILES.ai_media
}

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
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetAiSuggestions, {})],
  },
  {
    matcher: "/admin/ai/suggestions",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      rateLimit(aiSuggestionProfile, {
        identity: (req) => (req as AuthenticatedMedusaRequest).auth_context.actor_id,
      }),
      validateAndTransformBody(AdminPostAiSuggestion),
    ],
  },
  ...["/admin/ai/suggestions/:id/accept", "/admin/ai/suggestions/:id/dismiss"].map((matcher) => ({
    matcher,
    methods: ["POST" as const],
    middlewares: [requireUserActor],
  })),
]
