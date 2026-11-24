import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../lib/errors"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { GIFT_CARDS } from "../../modules/platform-settings/features"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import { StorePostGiftRecipient } from "../store/carts/[id]/line-items/[line_id]/gift/validators"
import { StorePostGiftCardBalance } from "../store/gift-cards/balance/validators"
import { fieldTokens } from "../validation/attribute-fields"
import { requireMailDomain } from "./mail-domain"
import { rateLimit } from "./rate-limit"
import { rejectRequest } from "./reject"
import { requireFeature } from "./require-feature"

/**
 * A product's extension as the Store API shows it: its gift card mark
 * (`fields=+product_extension.is_gift_card`), its description document
 * (adr/0055, `+product_extension.description_doc`), its short description
 * (adr/0055 Ek 2026-11-06, `+product_extension.summary_doc`) and its withdrawal mark
 * with the kind that reads it (`+product_extension.withdrawal_excluded,
 * +product_extension.kind`; adr/0052 Ek 2026-11-03, `productMarkOf`): on a
 * physical product a sealed good, returnable unopened (MSY md. 15/1-ç); on
 * a digital or service one, outside the right of withdrawal. The product
 * page says so before the purchase (MSY md. 5/1-h, 6/2).
 */
export const STORE_GIFT_PRODUCT_FIELDS = [
  "product_extension",
  "product_extension.is_gift_card",
  "product_extension.description_doc",
  "product_extension.summary_doc",
  "product_extension.withdrawal_excluded",
  "product_extension.kind",
  // adr/0076 §10: a dated product's page asks its departures (never through a cart line)
  "product_extension.booking_mode",
]

const EXTENSION = /product_extension/iu
// The mark, through any relation that reaches a product (`items.product.…`)
const GIFT_MARK = /^(?:[a-z_]+\.)*product_extension\.is_gift_card$/u
// On the product's own answer only: a cart line has no use for them
const PRODUCT_OWN =
  /^product_extension\.(?:description_doc|summary_doc|withdrawal_excluded|kind|booking_mode)$/u

/**
 * A product's extension in Store `fields`: its gift card mark and, on the
 * product itself, its description document, its short description, its
 * withdrawal mark and its kind. Its other columns (a successor, a
 * restriction's reason) are the shop's; any other spelling of the
 * relation, in any case, is refused.
 */
export function restrictStoreProductExtension(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  const refused = fieldTokens(req).some(
    (token) => EXTENSION.test(token) && !GIFT_MARK.test(token) && !PRODUCT_OWN.test(token)
  )
  if (refused) {
    rejectRequest(
      req,
      res,
      400,
      { type: "invalid_data", message: "The requested fields are not available" },
      "product_extension_fields"
    )
    return
  }
  next()
}

const marksCoreGiftCard = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  (value as { is_giftcard?: unknown }).is_giftcard === true

const rowsOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

/**
 * Medusa's own gift card mark on a product stays off: the loyalty plugin
 * issues a card for it as the order is placed, paid or not, with its weak
 * code (adr/0025). A shop sells cards with the catalog's `is_gift_card`.
 */
export function refuseCoreGiftCardProducts(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
): void {
  const body = req.body as { create?: unknown; update?: unknown } | undefined
  const marked =
    req.method === "POST" &&
    [body, ...rowsOf(body?.create), ...rowsOf(body?.update)].some(marksCoreGiftCard)
  next(marked ? new ValidationError("catalog.core_gift_card", { field: "is_giftcard" }) : undefined)
}

/**
 * Selling gift cards (adr/0025 Ek 2026-11-03), each route behind the
 * shop's `promotions.gift_cards` flag, which answers first. A gift line's
 * recipient is a cart write (the checkout's budget, per cart too) whose
 * address must take mail. A balance asked by its code is a guess at one:
 * ten a minute per address, and past three Turnstile (turnstile-routes.ts).
 */
export const GIFT_CARD_SALE_ROUTES = [
  { matcher: "/store/*", middlewares: [restrictStoreProductExtension] },
  { matcher: "/admin/products", middlewares: [refuseCoreGiftCardProducts] },
  {
    matcher: "/store/carts/:id/line-items/:line_id/gift",
    methods: ["POST" as const],
    middlewares: [
      requireFeature(GIFT_CARDS),
      rateLimit(() => RATE_LIMIT_PROFILES.checkout, { identity: (req) => req.params["id"] }),
      validateAndTransformBody(StorePostGiftRecipient),
      requireMailDomain("recipient_email"),
    ],
  },
  {
    matcher: "/store/carts/:id/gift-lines",
    methods: ["GET" as const],
    middlewares: [
      requireFeature(GIFT_CARDS),
      validateAndTransformQuery(AdminGetDashboardNoQuery, {}),
    ],
  },
  {
    matcher: "/store/gift-cards/balance",
    methods: ["POST" as const],
    middlewares: [
      requireFeature(GIFT_CARDS),
      rateLimit(() => RATE_LIMIT_PROFILES.gift_card_balance),
      validateAndTransformBody(StorePostGiftCardBalance),
    ],
  },
]
