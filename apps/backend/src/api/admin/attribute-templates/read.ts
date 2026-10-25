import type { MedusaContainer } from "@medusajs/framework/types"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../modules/product-attributes"
import type ProductAttributesModuleService from "../../../modules/product-attributes/service"
import type { AttributeDefinitionRecord } from "../../../modules/product-attributes/service"

const byRank = (a: AttributeDefinitionRecord, b: AttributeDefinitionRecord) =>
  a.rank - b.rank || a.key.localeCompare(b.key)

/** A template with its definitions in display order. */
export async function readTemplate(scope: MedusaContainer, id: string) {
  const service = scope.resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
  const template = await service.retrieveAttributeTemplate(id, { relations: ["definitions"] })
  return { ...template, definitions: [...template.definitions].sort(byRank) }
}
