import { validateAndTransformBody } from "@medusajs/framework/http"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { supportAccessRequestSchema } from "@qticaret/types/control-plane"
import { supportUser } from "../../lib/support-access/session"
import { requireUserActor } from "./actor"
import { rejectRequest } from "./reject"
import { SUPPORT_AUTH_ROUTES, openSupportSessionOf } from "./support-guard"

/**
 * adr/0061 Ek "Destek erişimi": a grant's redemption (JSON only, 8 KB,
 * the `/auth/*` login rate limit already counts it), a support session's
 * own "who am I" (it has no user row), and the owner's screen.
 */

/** `GET /admin/users/me` for a support session: its synthetic user (Karar 1). */
export function answerSupportUser(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const session = openSupportSessionOf(req)
  if (!session) {
    next()
    return
  }
  res.json({ user: supportUser(session) })
}

/** A grant comes as JSON, never as a form a page elsewhere could post. */
export function requireJson(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  if (!req.is("application/json")) {
    rejectRequest(
      req,
      res,
      415,
      { type: "invalid_data", message: "support.grant_invalid" },
      "support_not_json"
    )
    return
  }
  next()
}

export const SUPPORT_ROUTES = [
  ...SUPPORT_AUTH_ROUTES,
  {
    matcher: "/auth/support-access",
    methods: ["POST" as const],
    bodyParser: { sizeLimit: 8 * 1024 },
    middlewares: [requireJson, validateAndTransformBody(supportAccessRequestSchema)],
  },
  { matcher: "/admin/users/me", methods: ["GET" as const], middlewares: [answerSupportUser] },
  { matcher: "/admin/support-access", methods: ["GET" as const], middlewares: [requireUserActor] },
  {
    matcher: "/admin/support-access/sessions/:grant_id/end",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(z.strictObject({}))],
  },
]
