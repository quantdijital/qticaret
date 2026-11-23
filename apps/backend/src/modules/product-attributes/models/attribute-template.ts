import { model } from "@medusajs/framework/utils"
import { AttributeDefinition } from "./attribute-definition"

/** A set of product attributes a tenant defines (adr/0013): "Fabric", "Blade", "Book". */
export const AttributeTemplate = model.define("attribute_template", {
  id: model.id({ prefix: "atpl" }).primaryKey(),
  name: model.text(),
  handle: model.text().unique(),
  description: model.text().nullable(),
  /**
   * The spec table's sections (adr/0013 Ek 2026-11-04): `{ key, name, rank }[]`;
   * a definition names its section by `key`. None: one plain table.
   */
  groups: model.json().nullable(),
  /**
   * Add-on templates its products get (adr/0052 Ek 2026-11-23), in order:
   * a list of `addon_template` ids. None: null.
   */
  addon_template_ids: model.json().nullable(),
  definitions: model.hasMany(() => AttributeDefinition, { mappedBy: "template" }),
})
