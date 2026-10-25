import { model } from "@medusajs/framework/utils"
import { AttributeDefinition } from "./attribute-definition"

/**
 * A product's value for one attribute (adr/0013), in the column of its
 * type so facet filters (F3.17) can use indexes. Linked to the product.
 */
export const AttributeValue = model
  .define("attribute_value", {
    id: model.id({ prefix: "atval" }).primaryKey(),
    value_text: model.text().nullable(),
    value_number: model.bigNumber().nullable(),
    value_boolean: model.boolean().nullable(),
    // Selected option values for select and multi_select
    value_options: model.json().nullable(),
    definition: model.belongsTo(() => AttributeDefinition, { mappedBy: "values" }),
  })
  .indexes([{ on: ["definition_id", "value_number"] }, { on: ["definition_id", "value_text"] }])
