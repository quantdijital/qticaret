import type { Context, InferTypeOf } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
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
}) {
  /**
   * Values that hold this option of a filterable attribute with this key, in
   * any template (a facet, F3.17): a single choice in its text column, a
   * multiple one in its option list (GIN index); both indexed.
   */
  @InjectManager()
  async valuesWithOption(
    key: string,
    option: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string[]> {
    const manager = sharedContext.manager as {
      execute: (sql: string, params: unknown[]) => Promise<unknown>
    }
    const rows = (await manager.execute(
      `SELECT v.id FROM attribute_value v
         JOIN attribute_definition d ON d.id = v.definition_id
        WHERE v.deleted_at IS NULL AND d.deleted_at IS NULL
          AND d.key = ? AND d.is_filterable IS TRUE
          AND ((d.type = 'select' AND v.value_text = ?)
            OR (d.type = 'multi_select' AND v.value_options @> ?::jsonb))`,
      [key, option, JSON.stringify([option])]
    )) as { id: string }[]
    return rows.map((row) => row.id)
  }
}

export default ProductAttributesModuleService
