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
  // The spec table's sections (adr/0013 Ek 2026-11-04): the definition's key into
  // its template's list, and the list alone (names and order; nothing of other products)
  "attribute_values.definition.group",
  "attribute_values.definition.template.groups",
] as const

// Medusa's allowed list needs the relations named for the leaves to resolve
export const STORE_ATTRIBUTE_FIELDS = [
  "attribute_values",
  "attribute_values.definition",
  "attribute_values.definition.template",
  ...STORE_ATTRIBUTE_LEAVES,
]

// Anywhere in a path: `items.product.attribute_values` reaches them too
export const ATTRIBUTE_RELATION = /(^|\.)\*?attribute_(values|template)\b/

/** The store `fields` tokens, without their `+`/`-` prefix. */
export function fieldTokens(req: MedusaRequest): string[] {
  const fields: unknown = req.query["fields"]
  return (Array.isArray(fields) ? fields : [fields])
    .filter((value): value is string => typeof value === "string")
    .flatMap((value) => value.split(","))
    .map((token) => token.trim().replace(/^[+-]/, ""))
}

/**
 * Store `fields` that touch a relation must name its allowed leaves one by
 * one: the relation's name, `*relation` or `relation.*` would select every
 * column, and a deeper path would walk to other records' data. Defence in
 * depth over Medusa's allowed list, whose handling of these forms is
 * internal.
 */
export function restrictStoreRelation(relation: RegExp, leaves: readonly string[], reason: string) {
  return (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction): void => {
    const refused = fieldTokens(req).some(
      (token) => relation.test(token) && !leaves.includes(token)
    )
    if (refused) {
      rejectRequest(
        req,
        res,
        400,
        { type: "invalid_data", message: "The requested fields are not available" },
        reason
      )
      return
    }
    next()
  }
}

/**
 * A variant's extension holds its unit cost (F11.4), the shop's own: no
 * storefront asks for any of it (the MPN reaches structured data through
 * the server, not through `fields`). Matched anywhere in a token and in
 * any case: no spelling of the link reaches it.
 */
export const rejectStoreVariantExtension = restrictStoreRelation(
  /variant_extension/i,
  [],
  "variant_extension_fields"
)

/**
 * A variant's price rows (`variants.prices`, `variants.price_set.prices`):
 * the rows of every price list are among them, a wholesale level's and a
 * wholesaler's own too (ADR-0068 §7). The storefront reads prices only as
 * `calculated_price`, worked out for the shopper; no spelling of the rows
 * reaches it.
 */
export const rejectStorePriceRows = restrictStoreRelation(
  /price_set|(^|[.*])prices(\.|$)/i,
  [],
  "price_row_fields"
)

/** Product attributes: `.definition.template` or `.definition.values` would reach other products. */
export const restrictStoreAttributeFields = restrictStoreRelation(
  ATTRIBUTE_RELATION,
  STORE_ATTRIBUTE_LEAVES,
  "attribute_fields"
)
