import { model } from "@medusajs/framework/utils"
import { AttributeDefinition } from "./attribute-definition"

/** A set of product attributes a tenant defines (adr/0013): "Fabric", "Blade", "Book". */
export const AttributeTemplate = model.define("attribute_template", {
  id: model.id({ prefix: "atpl" }).primaryKey(),
  name: model.text(),
  handle: model.text().unique(),
  description: model.text().nullable(),
  definitions: model.hasMany(() => AttributeDefinition, { mappedBy: "template" }),
})
