import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rejectRequest } from "../http/reject"

// Linked data that must never be selectable through `fields` (adr/0009)
const SENSITIVE_FIELD = /billing_profile|tax_id/i

/**
 * Defence in depth for docs/04 on /store and /admin: Medusa's store routes
 * drop fields outside their allow lists (tested), but admin routes expand
 * links freely: `/admin/customers?fields=*billing_profile` would return the
 * encrypted tax id and its hash for every customer, unrecorded. The masked
 * profile has its own audited route (`/admin/customers/:id/billing-profile`).
 */
export function rejectSensitiveFields(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  const fields: unknown = req.query["fields"]
  const values = Array.isArray(fields) ? fields : [fields]
  const requested = values.filter((value): value is string => typeof value === "string").join(",")
  if (SENSITIVE_FIELD.test(requested)) {
    rejectRequest(
      req,
      res,
      400,
      { type: "invalid_data", message: "The requested fields are not available" },
      "sensitive_fields"
    )
    return
  }
  next()
}
