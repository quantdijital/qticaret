import type { MedusaRequest } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { GIFT_CARDS } from "../../modules/platform-settings/features"
import { giftCardCodes } from "../validation/gift-card-codes"
import { storeCreditGuards } from "../validation/store-credit"
import { rateLimit } from "./rate-limit"
import { decodedSegment, routePath, routePathKeepingCase } from "./request-path"
import { requireFeature } from "./require-feature"
import { shopperGiftCardAnswers } from "./shopper-gift-cards"

// A shopper trying a code: adding a card to a cart or taking it off, looking one up
const CART_CODE = /^\/store\/carts\/(?<cart>[^/]+)\/gift-cards$/iu
const LOOKUP = /^\/store\/gift-cards\/./u

export function codeTry(req: MedusaRequest) {
  const path = routePath(req)
  const tries =
    // Express answers HEAD with the GET route: every way of asking counts
    (LOOKUP.test(path) && req.method !== "OPTIONS") ||
    ((req.method === "POST" || req.method === "DELETE") && CART_CODE.test(path))
  return tries ? RATE_LIMIT_PROFILES.coupon : null
}

// Counted per address, and on a cart per cart too (as the route reads its id);
// with promotion codes, as one budget
const codeTries = rateLimit(codeTry, {
  identity: (req) => {
    const cart = CART_CODE.exec(routePathKeepingCase(req))?.groups?.["cart"]
    return cart === undefined ? undefined : decodedSegment(cart)
  },
})

/**
 * F4.8 (ADR-0025): the loyalty plugin's gift card and store credit routes,
 * there only while the shop's `promotions.gift_cards` flag is on; off,
 * they answer as routes that do not exist. Then code tries are limited,
 * codes read in one form, and store credit kept to its owner
 * (`validation/store-credit.ts`). Without `methods`, so all of it runs
 * before the plugin validates the body (a 400 would give the routes away),
 * on every path below each matcher. What a shopper sees of a card:
 * `shopper-gift-cards.ts`.
 */
export const GIFT_CARD_ROUTES = [
  ...[
    "/admin/gift-cards",
    "/admin/store-credit-accounts",
    "/store/gift-cards",
    "/store/store-credit-accounts",
    "/store/carts/:id/gift-cards",
    "/store/carts/:id/store-credits",
  ].map((matcher) => ({
    matcher,
    middlewares: [
      requireFeature(GIFT_CARDS),
      codeTries,
      giftCardCodes,
      storeCreditGuards,
      ...(matcher.startsWith("/store/") ? [shopperGiftCardAnswers] : []),
    ],
  })),
]
