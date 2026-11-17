import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { authenticate, validateAndTransformQuery } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { StoreGetWholesalePrices } from "../store/customers/me/wholesale-prices/validators"
import { StoreGetWholesale } from "../store/customers/me/wholesale/validators"
import { StoreGetOrderWholesale } from "../store/orders/[id]/wholesale/validators"
import { optionalCustomer, orderAccess } from "./order-access"
import { rateLimit } from "./rate-limit"
import { repriceWholesaleTransfer } from "./wholesale-cart-transfer"

// The session's customer only: no customer or group id is ever read from the request
const signedIn = () => authenticate("customer", ["session", "bearer"])

/**
 * ADR-0068 slice 3 (§7): the signed-in wholesaler's own answers. Behind a
 * session (the explicit authenticate keeps them closed whatever core's
 * `/me` matchers do); answered the same for every non-wholesaler, the
 * flag off included, so no 404 tells the feature or an account apart.
 * Prices are counted per customer too. Reads only: no Store write of
 * ours; Medusa's cart transfer is followed by a reprice for a wholesaler.
 * An order's own yes or no opens as the order page does (its customer or
 * its key, `orderAccess`), not by session.
 */
export const WHOLESALE_STORE_ROUTES = [
  {
    matcher: "/store/customers/me/wholesale",
    methods: ["GET" as const],
    middlewares: [signedIn(), validateAndTransformQuery(StoreGetWholesale, {})],
  },
  {
    matcher: "/store/customers/me/wholesale-prices",
    methods: ["GET" as const],
    middlewares: [
      signedIn(),
      rateLimit(() => RATE_LIMIT_PROFILES.wholesale_prices, {
        identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
      }),
      validateAndTransformQuery(StoreGetWholesalePrices, {}),
    ],
  },
  // Slice 5 review L2: the order page's purchase event asks the order, the same access as the page
  {
    matcher: "/store/orders/:id/wholesale",
    methods: ["GET" as const],
    middlewares: [
      optionalCustomer,
      orderAccess,
      validateAndTransformQuery(StoreGetOrderWholesale, {}),
    ],
  },
  // A guest's cart taken by a wholesaler signing in is priced at wholesale at once (§7)
  { matcher: "/store/carts/:id/customer", middlewares: [repriceWholesaleTransfer] },
]
