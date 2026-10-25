import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ConflictError } from "../../../lib/errors"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../modules/product-attributes"
import type ProductAttributesModuleService from "../../../modules/product-attributes/service"

interface Removed {
  templateId: string
  definitionIds: string[]
}

/** Deletes a template no product follows; one in use is refused (409). */
export const deleteAttributeTemplateStep = createStep(
  "product-attributes-delete-template",
  async (id: string, { container }) => {
    const service = container.resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    const template = await service.retrieveAttributeTemplate(id, { relations: ["definitions"] })
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "attribute_template",
      fields: ["products.id"],
      filters: { id },
    })
    const products = (data[0] as { products?: unknown[] } | undefined)?.products ?? []
    const definitionIds = template.definitions.map((definition) => definition.id)
    const values = await service.listAttributeValues(
      { definition_id: definitionIds },
      { select: ["id"], take: 1 }
    )
    if (products.length > 0 || values.length > 0) {
      throw new ConflictError("product_attributes.template_in_use")
    }
    if (definitionIds.length > 0) {
      await service.softDeleteAttributeDefinitions(definitionIds)
    }
    await service.softDeleteAttributeTemplates([id])
    return new StepResponse({ id }, { templateId: id, definitionIds })
  },
  async (removed: Removed | undefined, { container }) => {
    if (!removed) {
      return
    }
    const service = container.resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    await service.restoreAttributeTemplates([removed.templateId])
    if (removed.definitionIds.length > 0) {
      await service.restoreAttributeDefinitions(removed.definitionIds)
    }
  }
)
