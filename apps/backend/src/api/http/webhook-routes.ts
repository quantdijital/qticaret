import { validateAndTransformBody } from "@medusajs/framework/http"
import { AdminPostWebhook, AdminPostWebhookUpdate } from "../admin/webhooks/validators"

/**
 * F11.7: the shop's outgoing webhooks. Staff and keys with
 * `webhooks:manage` (the scope layer, api-key-guard.ts); the body checked
 * here, the address against internal hosts (KK3).
 */
export const WEBHOOK_ROUTES = [
  {
    matcher: "/admin/webhooks",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostWebhook)],
  },
  {
    matcher: "/admin/webhooks/:id",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostWebhookUpdate)],
  },
]
