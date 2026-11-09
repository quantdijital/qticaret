import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { GIFT_CARDS } from "../../modules/platform-settings/features"
import { AdminGetGiftCardList } from "../admin/gift-card-list/validators"
import { AdminGetProductBoard } from "../admin/product-board/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"
import { requireFeature } from "./require-feature"

// No body at all (CLAUDE.md: every route has its schema)
const NO_BODY = z.object({}).strict()

/**
 * The panel's product list, a product's copy and its storefront link
 * (owner 2026-11-06), and the gift cards' paged list (adr/0025).
 */
export const PRODUCT_BOARD_ROUTES = [
  {
    matcher: "/admin/product-board",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetProductBoard, {})],
  },
  {
    matcher: "/admin/products/:id/duplicate",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(NO_BODY)],
  },
  // A published product's address, or a draft's signed preview link (F18)
  {
    matcher: "/admin/products/:id/preview",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(NO_BODY)],
  },
  {
    matcher: "/store/product-preview/:token",
    methods: ["GET" as const],
    middlewares: [rateLimit(() => RATE_LIMIT_PROFILES.content_preview)],
  },
  // Codes spend cards and notes name people: for people, a recorded read (SENSITIVE_READS)
  {
    matcher: "/admin/gift-card-list",
    methods: ["GET" as const],
    middlewares: [
      requireFeature(GIFT_CARDS),
      requireUserActor,
      validateAndTransformQuery(AdminGetGiftCardList, {}),
    ],
  },
]
