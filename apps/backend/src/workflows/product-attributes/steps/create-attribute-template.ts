import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError, uniqueViolationKeys } from "../../../lib/errors"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../modules/product-attributes"
import type ProductAttributesModuleService from "../../../modules/product-attributes/service"
import { duplicateKeys, strayGroups } from "../../../modules/product-attributes/validation"
import type {
  AttributeGroup,
  DefinitionInput,
} from "../../../modules/product-attributes/validation"

export interface CreateAttributeTemplateInput {
  name: string
  handle: string
  description?: string | null | undefined
  /** The spec table's sections (adr/0013 Ek 2026-11-04); none: one plain table. */
  groups?: AttributeGroup[] | undefined
  definitions: DefinitionInput[]
}

/** A json column is typed as an object; it holds the sections' list, none as null. */
export const groupsColumn = (groups: readonly AttributeGroup[]) =>
  (groups.length > 0 ? groups : null) as unknown as Record<string, unknown> | null

/** Every definition's section must be one of the template's. */
export function checkGroups(
  definitions: readonly DefinitionInput[],
  groups: readonly AttributeGroup[]
): void {
  if (strayGroups(definitions, groups).length > 0) {
    throw new ValidationError("product_attributes.group_unknown", { field: "definitions" })
  }
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
  // Left out, it stays as it was (shown when new: the column's default)
  ...(definition.is_public === undefined ? {} : { is_public: definition.is_public }),
  scope: definition.scope ?? "product",
  option_title: definition.option_title ?? null,
  varies_by: definition.varies_by ?? null,
  // Left out, it stays as it was (none when new)
  ...(definition.group === undefined ? {} : { group: definition.group }),
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
    checkGroups(input.definitions, input.groups ?? [])
    const service = container.resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    let templateId: string | undefined
    try {
      const template = await service.createAttributeTemplates({
        name: input.name,
        handle: input.handle,
        description: input.description ?? null,
        groups: groupsColumn(input.groups ?? []),
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
