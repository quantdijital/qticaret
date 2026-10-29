import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { validateAndTransformBody } from "@medusajs/framework/http"
import { EVENT_SCOPES } from "../../lib/webhooks"
import type { WebhookEvent } from "../../lib/webhooks"
import { API_KEY_SCOPES_MODULE } from "../../modules/api-key-scopes"
import type ApiKeyScopesModuleService from "../../modules/api-key-scopes/service"
import { AdminPostWebhook, AdminPostWebhookUpdate } from "../admin/webhooks/validators"
import { apiKeyOf } from "./api-key-guard"
import { rejectRequest } from "./reject"

/**
 * A key subscribes only to events its read scopes cover: `webhooks:manage`
 * alone would otherwise receive the orders and stock `orders:read` and
 * `catalog:read` guard. Staff subscribe to any.
 */
async function keyEventsInScope(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const keyId = apiKeyOf(req)
  const events = (req.validatedBody as { events?: WebhookEvent[] } | undefined)?.events
  if (!keyId || !events) {
    next()
    return
  }
  const scopes = await req.scope
    .resolve<ApiKeyScopesModuleService>(API_KEY_SCOPES_MODULE)
    .scopesOf(keyId)
  if (events.some((event) => !scopes.includes(EVENT_SCOPES[event]))) {
    rejectRequest(
      req,
      res,
      403,
      { type: "not_allowed", message: "webhook.event_scope" },
      "webhook_event_scope"
    )
    return
  }
  next()
}

/**
 * F11.7: the shop's outgoing webhooks. Staff and keys with
 * `webhooks:manage` (the scope layer, api-key-guard.ts); the body checked
 * here, the address against internal hosts (KK3), a key's events against
 * its read scopes.
 */
export const WEBHOOK_ROUTES = [
  {
    matcher: "/admin/webhooks",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostWebhook), keyEventsInScope],
  },
  {
    matcher: "/admin/webhooks/:id",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostWebhookUpdate), keyEventsInScope],
  },
]
