import type { Context, InferTypeOf } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { AddonTemplate } from "./models/addon-template"
import { AttributeDefinition } from "./models/attribute-definition"
import { AttributeTemplate } from "./models/attribute-template"
import { AttributeValue } from "./models/attribute-value"

export type AddonTemplateRecord = InferTypeOf<typeof AddonTemplate>
export type AttributeTemplateRecord = InferTypeOf<typeof AttributeTemplate>
export type AttributeDefinitionRecord = InferTypeOf<typeof AttributeDefinition>
export type AttributeValueRecord = InferTypeOf<typeof AttributeValue>

/**
 * Attribute templates, their definitions and products' values (F2.4,
 * adr/0013), and add-on templates (adr/0052 Ek 2026-11-23). The rules (key format, option lists, type locks, one value per
 * product and definition) live in the workflows that write here.
 */
class ProductAttributesModuleService extends MedusaService({
  AddonTemplate,
  AttributeTemplate,
  AttributeDefinition,
  AttributeValue,
}) {
  /**
   * Values that hold any of these options of a filterable attribute with
   * this key, in any template (a facet, F3.16–17): a single choice in its
   * text column, a multiple one in its option list (GIN index, one
   * containment test per option); both indexed. At most a filter's options.
   */
  @InjectManager()
  async valuesWithOptions(
    key: string,
    options: string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string[]> {
    if (options.length === 0) {
      return []
    }
    const manager = sharedContext.manager as {
      execute: (sql: string, params: unknown[]) => Promise<unknown>
    }
    const marks = options.map(() => "?").join(", ")
    const contains = options.map(() => "v.value_options @> ?::jsonb").join(" OR ")
    const rows = (await manager.execute(
      `SELECT v.id FROM attribute_value v
         JOIN attribute_definition d ON d.id = v.definition_id
        WHERE v.deleted_at IS NULL AND d.deleted_at IS NULL
          AND d.key = ? AND d.is_filterable IS TRUE
          AND ((d.type = 'select' AND v.value_text IN (${marks}))
            OR (d.type = 'multi_select' AND (${contains})))`,
      [key, ...options, ...options.map((option) => JSON.stringify([option]))]
    )) as { id: string }[]
    return rows.map((row) => row.id)
  }
}

export default ProductAttributesModuleService
