import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError, uniqueViolationKeys } from "../../../lib/errors"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../modules/product-attributes"
import type ProductAttributesModuleService from "../../../modules/product-attributes/service"
import { duplicateKeys } from "../../../modules/product-attributes/validation"
import type { DefinitionInput } from "../../../modules/product-attributes/validation"

export interface CreateAttributeTemplateInput {
  name: string
  handle: string
  description?: string | null | undefined
  definitions: DefinitionInput[]
}

export const definitionRow = (definition: DefinitionInput, templateId: string) => ({
  key: definition.key,
  label: definition.label,
  type: definition.type,
  unit: definition.unit ?? null,
  // A json column is typed as an object; it holds the `{ value, label }[]` list
  options: (definition.options ?? null) as unknown as Record<string, unknown> | null,
  rank: definition.rank ?? 0,
  is_required: definition.is_required ?? false,
  is_filterable: definition.is_filterable ?? false,
  is_seo_highlight: definition.is_seo_highlight ?? false,
  is_public: definition.is_public ?? true,
  scope: definition.scope ?? "product",
  option_title: definition.option_title ?? null,
  varies_by: definition.varies_by ?? null,
  template_id: templateId,
})

/** A unique violation on the handle or a key, as the error the admin can act on. */
export function attributeConflict(error: unknown): unknown {
  const keys = uniqueViolationKeys(error)
  if (keys?.includes("handle")) {
    return new ValidationError("product_attributes.handle_taken", { field: "handle" })
  }
  if (keys?.includes("key")) {
    return new ValidationError("product_attributes.key_taken", { field: "definitions" })
  }
  return error
}

export const createAttributeTemplateStep = createStep(
  "product-attributes-create-template",
  async (input: CreateAttributeTemplateInput, { container }) => {
    if (duplicateKeys(input.definitions).length > 0) {
      throw new ValidationError("product_attributes.key_taken", { field: "definitions" })
    }
    const service = container.resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    let templateId: string | undefined
    try {
      const template = await service.createAttributeTemplates({
        name: input.name,
        handle: input.handle,
        description: input.description ?? null,
      })
      templateId = template.id
      if (input.definitions.length > 0) {
        await service.createAttributeDefinitions(
          input.definitions.map((definition) => definitionRow(definition, template.id))
        )
      }
      return new StepResponse({ id: template.id }, template.id)
    } catch (error) {
      if (templateId) {
        await service.deleteAttributeTemplates(templateId)
      }
      throw attributeConflict(error)
    }
  },
  async (templateId: string | undefined, { container }) => {
    if (!templateId) {
      return
    }
    const service = container.resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    const definitions = await service.listAttributeDefinitions(
      { template_id: templateId },
      { select: ["id"] }
    )
    await service.deleteAttributeDefinitions(definitions.map((definition) => definition.id))
    await service.deleteAttributeTemplates(templateId)
  }
)
