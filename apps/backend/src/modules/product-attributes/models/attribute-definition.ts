import { model } from "@medusajs/framework/utils"
import { AttributeTemplate } from "./attribute-template"
import { AttributeValue } from "./attribute-value"

export const ATTRIBUTE_TYPES = ["text", "number", "boolean", "select", "multi_select"] as const
// The only values Google reads in variesBy (docs/13 §2.3)
export const VARIES_BY = [
  "color",
  "size",
  "suggestedAge",
  "suggestedGender",
  "material",
  "pattern",
] as const

/**
 * One attribute of a template (adr/0013). A `variant` attribute holds no
 * values here: its values are Medusa's product options (`option_title`).
 */
export const AttributeDefinition = model
  .define("attribute_definition", {
    id: model.id({ prefix: "atdef" }).primaryKey(),
    key: model.text(),
    label: model.text(),
    type: model.enum([...ATTRIBUTE_TYPES]),
    unit: model.text().nullable(),
    // `{ value, label }[]` for select types
    options: model.json().nullable(),
    rank: model.number().default(0),
    is_required: model.boolean().default(false),
    is_filterable: model.boolean().default(false),
    is_seo_highlight: model.boolean().default(false),
    /**
     * Shown to shoppers (T5, adr/0013 addendum): off for the shop's own
     * notes (a supplier code), which the Store API never returns.
     */
    is_public: model.boolean().default(true),
    scope: model.enum(["product", "variant"]).default("product"),
    // Its section of the spec table: a key of its template's `groups` (adr/0013 Ek 2026-11-04)
    group: model.text().nullable(),
    option_title: model.text().nullable(),
    varies_by: model.enum([...VARIES_BY]).nullable(),
    template: model.belongsTo(() => AttributeTemplate, { mappedBy: "definitions" }),
    values: model.hasMany(() => AttributeValue, { mappedBy: "definition" }),
  })
  .indexes([{ on: ["template_id", "key"], unique: true, where: "deleted_at IS NULL" }])
