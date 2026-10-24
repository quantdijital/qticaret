import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rejectRequest } from "../http/reject"

// Linked data that must never be selectable through store `fields` (adr/0009)
const SENSITIVE_FIELD = /billing_profile|tax_id/i

/**
 * Defence in depth for docs/04: Medusa's store routes already drop fields
 * outside their allow lists (tested), but a route that forgets one must not
 * expose tax identities through `?fields=`.
 */
export function rejectSensitiveStoreFields(
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
