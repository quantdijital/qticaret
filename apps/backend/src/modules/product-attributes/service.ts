import type { InferTypeOf } from "@medusajs/framework/types"
import { MedusaService } from "@medusajs/framework/utils"
import { AttributeDefinition } from "./models/attribute-definition"
import { AttributeTemplate } from "./models/attribute-template"
import { AttributeValue } from "./models/attribute-value"

export type AttributeTemplateRecord = InferTypeOf<typeof AttributeTemplate>
export type AttributeDefinitionRecord = InferTypeOf<typeof AttributeDefinition>
export type AttributeValueRecord = InferTypeOf<typeof AttributeValue>

/**
 * Attribute templates, their definitions and products' values (F2.4,
 * adr/0013). The rules (key format, option lists, type locks, one value per
 * product and definition) live in the workflows that write here.
 */
class ProductAttributesModuleService extends MedusaService({
  AttributeTemplate,
  AttributeDefinition,
  AttributeValue,
}) {}

export default ProductAttributesModuleService
