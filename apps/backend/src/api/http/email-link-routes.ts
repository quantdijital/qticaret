import { validateAndTransformBody } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { StorePostConsentConfirm } from "../store/consents/confirm/validators"
import { StorePostUnsubscribe } from "../store/consents/unsubscribe/validators"
import { StorePostStockAlertConfirm } from "../store/stock-alerts/confirm/validators"
import { rateLimit } from "./rate-limit"

const linkLimit = rateLimit(() => RATE_LIMIT_PROFILES.webhook)

/**
 * The token links in messages (adr/0038 §1, M17, Ek 2026-11-02; F10.5):
 * opened from a mail by anyone holding the link, so the token is the only
 * key. The storefront's pages ask the `/store/...` endpoints; the backend's
 * own pages stay for links already sent, and send a visitor on to the
 * storefront's once the shop has a host. All within the same budget.
 */
export const EMAIL_LINK_ROUTES = [
  { matcher: "/unsubscribe", middlewares: [linkLimit] },
  { matcher: "/consents/confirm", middlewares: [linkLimit] },
  { matcher: "/stock-alerts/confirm", middlewares: [linkLimit] },
  {
    matcher: "/store/consents/unsubscribe",
    methods: ["POST" as const],
    middlewares: [linkLimit, validateAndTransformBody(StorePostUnsubscribe)],
  },
  {
    matcher: "/store/consents/confirm",
    methods: ["POST" as const],
    middlewares: [linkLimit, validateAndTransformBody(StorePostConsentConfirm)],
  },
  {
    matcher: "/store/stock-alerts/confirm",
    methods: ["POST" as const],
    middlewares: [linkLimit, validateAndTransformBody(StorePostStockAlertConfirm)],
  },
]
