import { validateAndTransformQuery } from "@medusajs/framework/http"
import { StoreGetPriceDisplay } from "../store/price-display/validators"

/** F4.3: how prices are shown in the storefront (ADR-0023). */
export const PRICING_ROUTES = [
  {
    matcher: "/store/price-display",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(StoreGetPriceDisplay, {})],
  },
]
