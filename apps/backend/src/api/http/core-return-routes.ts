import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"

/**
 * Medusa's own returns, claims and exchanges skip the return requests
 * (adr/0032): no window, no approval, no refund through ours, and a return
 * opened that way blocks the shopper's own request. Ours run Medusa's
 * workflows themselves, never these routes, so their changes are closed;
 * reads stay (audited, SENSITIVE_READS). Medusa's store route opens a
 * return for anyone holding an order id: answered as missing (security
 * review 2026-10-28).
 */
function refuseCoreChange(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  next(req.method === "GET" ? undefined : new ValidationError("returns.use_return_requests"))
}

function hideStoreReturns(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  next(req.method === "GET" ? undefined : new MedusaError(MedusaError.Types.NOT_FOUND, "Not found"))
}

// No `methods` on purpose: a method-scoped middleware may sort after the core route
export const CORE_RETURN_ROUTES = [
  ...["/store/returns", "/store/returns/*"].map((matcher) => ({
    matcher,
    middlewares: [hideStoreReturns],
  })),
  ...["returns", "claims", "exchanges"].flatMap((area) =>
    [`/admin/${area}`, `/admin/${area}/*`].map((matcher) => ({
      matcher,
      middlewares: [refuseCoreChange],
    }))
  ),
]
