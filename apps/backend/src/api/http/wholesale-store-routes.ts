import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { authenticate, validateAndTransformQuery } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { StoreGetWholesalePrices } from "../store/customers/me/wholesale-prices/validators"
import { rateLimit } from "./rate-limit"

// The session's customer only: no customer or group id is ever read from the request
const signedIn = () => authenticate("customer", ["session", "bearer"])

/**
 * ADR-0068 slice 3 (§7): the signed-in wholesaler's own answers. Behind a
 * session (the explicit authenticate keeps them closed whatever core's
 * `/me` matchers do); answered the same for every non-wholesaler, the
 * flag off included, so no 404 tells the feature or an account apart.
 * Prices are counted per customer too. Reads only: no Store write.
 */
export const WHOLESALE_STORE_ROUTES = [
  {
    matcher: "/store/customers/me/wholesale",
    methods: ["GET" as const],
    middlewares: [signedIn()],
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
]
