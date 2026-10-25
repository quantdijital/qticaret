import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rejectRequest } from "../http/reject"

// Anywhere in a path: `items.product.seo_meta` reaches it too
const SEO_RELATION = /(^|\.)\*?seo_meta\b/

/**
 * A page's raw SEO fields never leave through the Store API (adr/0015):
 * the focus keyword is marketing data, and the storefront gets the
 * resolved payload instead (F3.4b). Defence in depth over Medusa's
 * allowed field lists, whose handling of link fields is internal.
 */
export function rejectStoreSeoFields(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  const fields: unknown = req.query["fields"]
  const values = (Array.isArray(fields) ? fields : [fields]).filter(
    (value): value is string => typeof value === "string"
  )
  const touched = values
    .flatMap((value) => value.split(","))
    .some((token) => SEO_RELATION.test(token.trim().replace(/^[+-]/, "")))
  if (touched) {
    rejectRequest(
      req,
      res,
      400,
      { type: "invalid_data", message: "The requested fields are not available" },
      "store_seo_fields"
    )
    return
  }
  next()
}
