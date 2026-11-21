import type { AuthenticatedMedusaRequest, MedusaRequest } from "@medusajs/framework/http"
import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { findAiTask } from "../../lib/ai/registry/tasks"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import {
  AdminGetAiSuggestions,
  AdminGetAiUsage,
  AdminPostAiAccept,
  AdminPostAiFaq,
  AdminPostAiGuidancePreview,
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
  // A `photo` task may send the product's picture: counted as one that does
  return task === null || (task.capability === "text" && task.photo !== true)
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
  {
    matcher: "/admin/ai/suggestions/:id/accept",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostAiAccept)],
  },
  // A product's FAQ draft taken: the kept items, gated again, added as the shop's questions
  {
    matcher: "/admin/ai/suggestions/:id/faq",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostAiFaq)],
  },
  {
    matcher: "/admin/ai/suggestions/:id/dismiss",
    methods: ["POST" as const],
    middlewares: [requireUserActor],
  },
  // "Dene" on the guidance page (adr/0074 §2): two text calls, a correction each at
  // most, so a budget of its own, narrower than an ask's (#247 D1)
  {
    matcher: "/admin/ai/guidance/preview",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      rateLimit(() => RATE_LIMIT_PROFILES.ai_preview, {
        identity: (req) => (req as AuthenticatedMedusaRequest).auth_context.actor_id,
      }),
      validateAndTransformBody(AdminPostAiGuidancePreview),
    ],
  },
  // The text tasks' default crafts and fixed rules (adr/0074 §3): code's text only
  {
    matcher: "/admin/ai/guidance/crafts",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
  // The acceptance rate by task (adr/0074 §4): counts only
  {
    matcher: "/admin/ai/acceptance",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
]
