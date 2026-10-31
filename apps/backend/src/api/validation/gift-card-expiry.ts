import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../lib/errors"
import { routePath } from "../http/request-path"

/**
 * Gift cards do not expire (adr/0025, the owner's decision of 2026-10-31):
 * a card is a means of payment its holder spends until nothing is left,
 * so no balance lapses unspent and none has to be booked as such. A card
 * made or changed with a last day is refused (400 `gift_cards.no_expiry`);
 * clearing one (`null`) passes. Registered without `methods`, before the
 * plugin validates the body.
 */

// The card itself: made at the collection, changed at its id
const CARD = /^\/admin\/gift-cards(?:\/[^/]+)?$/u

export function cardsWithoutExpiry(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const body: unknown = req.body
  const lastDay =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)["expires_at"]
      : undefined
  if (
    req.method === "POST" &&
    CARD.test(routePath(req)) &&
    lastDay !== undefined &&
    lastDay !== null
  ) {
    next(new ValidationError("gift_cards.no_expiry", { field: "expires_at" }))
    return
  }
  next()
}
