import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rejectRequest } from "../http/reject"

/**
 * Product attributes in the Store API (adr/0013): the value columns and the
 * definition fields a storefront needs. Options are opened too: a choice is
 * stored by its value, the storefront shows its label.
 */
export const STORE_ATTRIBUTE_LEAVES = [
  "attribute_values.id",
  "attribute_values.value_text",
  "attribute_values.value_number",
  "attribute_values.value_boolean",
  "attribute_values.value_options",
  "attribute_values.definition.key",
  "attribute_values.definition.label",
  "attribute_values.definition.type",
  "attribute_values.definition.unit",
  "attribute_values.definition.rank",
  "attribute_values.definition.options",
  "attribute_values.definition.is_seo_highlight",
] as const

// Medusa's allowed list needs the relations named for the leaves to resolve
export const STORE_ATTRIBUTE_FIELDS = [
  "attribute_values",
  "attribute_values.definition",
  ...STORE_ATTRIBUTE_LEAVES,
]

// Anywhere in a path: `items.product.attribute_values` reaches them too
const ATTRIBUTE_RELATION = /(^|\.)\*?attribute_(values|template)\b/

/**
 * Store `fields` that touch product attributes must name allowed leaves one
 * by one: a relation name, `*attribute_values` or `attribute_values.*`
 * would select every column, and a deeper path (`.definition.template`,
 * `.definition.values`) would walk to other products' data. Defence in
 * depth over Medusa's allowed list, whose handling of these forms is
 * internal.
 */
export function restrictStoreAttributeFields(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): void {
  const fields: unknown = req.query["fields"]
  const values = (Array.isArray(fields) ? fields : [fields]).filter(
    (value): value is string => typeof value === "string"
  )
  const tokens = values
    .flatMap((value) => value.split(","))
    .map((token) => token.trim().replace(/^[+-]/, ""))
  const leaves: readonly string[] = STORE_ATTRIBUTE_LEAVES
  const refused = tokens.some((token) => ATTRIBUTE_RELATION.test(token) && !leaves.includes(token))
  if (refused) {
    rejectRequest(
      req,
      res,
      400,
      { type: "invalid_data", message: "The requested fields are not available" },
      "attribute_fields"
    )
    return
  }
  next()
}
