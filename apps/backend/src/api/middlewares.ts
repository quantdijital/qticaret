import {
  authenticate,
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../lib/security/rate-limit"
import { csrfProtection } from "./http/csrf"
import { platformErrorHandler } from "./http/error-handler"
import { authIdentity, authProfile, rateLimit } from "./http/rate-limit"
import { requestContext } from "./http/request-id"
import { storeLimitGuard, uploadSizeGate } from "./http/request-limits"
import { securityHeaders } from "./http/security-headers"
import { uploadValidator } from "./http/upload-validator"
import { StorePostBillingProfile } from "./store/customers/me/billing-profile/validators"
import {
  StoreGetTrDistricts,
  StoreGetTrNeighborhoods,
  StoreGetTrProvinces,
} from "./store/tr-address/validators"
import { rejectSensitiveStoreFields } from "./validation/sensitive-fields"
import {
  ROOT,
  existingCartAddresses,
  existingCustomerAddress,
  validateTrAddresses,
} from "./validation/tr-address"

const CART_ADDRESSES = ["shipping_address", "billing_address"] as const

export default defineMiddlewares({
  // F2.10: sanitized error bodies with request_id, logged with redaction
  errorHandler: platformErrorHandler,
  routes: [
    // F2.10: validated request ID and log context, security headers, CSRF;
    // these run after Medusa's body parser, CORS and authentication
    {
      matcher: "/*",
      middlewares: [requestContext, securityHeaders, csrfProtection, uploadSizeGate],
    },
    // F2.10: rate limits per area; login, registration and reset per identity too
    {
      matcher: "/auth/*",
      methods: ["POST"],
      middlewares: [rateLimit(authProfile, { identity: authIdentity })],
    },
    {
      matcher: "/store/*",
      middlewares: [
        rateLimit(() => RATE_LIMIT_PROFILES.store_default),
        storeLimitGuard,
        rejectSensitiveStoreFields,
      ],
    },
    {
      matcher: "/admin/*",
      middlewares: [rateLimit(() => RATE_LIMIT_PROFILES.admin_default)],
    },
    // F2.9b: uploaded files checked by their bytes, after Medusa's multer
    {
      matcher: "/admin/uploads",
      methods: ["POST"],
      middlewares: [uploadValidator],
    },
    {
      matcher: "/store/tr-address/provinces",
      methods: ["GET"],
      middlewares: [validateAndTransformQuery(StoreGetTrProvinces, {})],
    },
    {
      matcher: "/store/tr-address/districts",
      methods: ["GET"],
      middlewares: [validateAndTransformQuery(StoreGetTrDistricts, {})],
    },
    {
      matcher: "/store/tr-address/neighborhoods",
      methods: ["GET"],
      middlewares: [validateAndTransformQuery(StoreGetTrNeighborhoods, {})],
    },
    // F1.4: Turkish address checks on core routes; they run after Medusa's
    // own authentication and body validation for these routes.
    {
      matcher: "/store/customers/me/addresses",
      methods: ["POST"],
      middlewares: [validateTrAddresses([ROOT])],
    },
    {
      matcher: "/store/customers/me/addresses/:address_id",
      methods: ["POST"],
      middlewares: [validateTrAddresses([ROOT], existingCustomerAddress)],
    },
    {
      matcher: "/store/carts",
      methods: ["POST"],
      middlewares: [validateTrAddresses([...CART_ADDRESSES])],
    },
    // F1.5: billing profile; the explicit authenticate keeps the route
    // protected even if core matchers for /store/customers/me change.
    {
      matcher: "/store/customers/me/billing-profile",
      methods: ["GET"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/customers/me/billing-profile",
      methods: ["POST"],
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(StorePostBillingProfile),
      ],
    },
    {
      matcher: "/store/carts/:id",
      methods: ["POST"],
      middlewares: [validateTrAddresses([...CART_ADDRESSES], existingCartAddresses)],
    },
  ],
})
