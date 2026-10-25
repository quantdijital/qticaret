import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../modules/product-attributes"
import type ProductAttributesModuleService from "../../../modules/product-attributes/service"
import type { ValueColumns } from "../../../modules/product-attributes/values"
import type { ProductAttributesPlan } from "./plan-product-attributes"

// A json column is typed as an object; `value_options` holds a list
const row = <T extends ValueColumns>(columns: T) => ({
  ...columns,
  value_options: columns.value_options as unknown as Record<string, unknown> | null,
})

interface Written {
  createdIds: string[]
  updated: (ValueColumns & { id: string })[]
  removedIds: string[]
}

/** Writes a plan's values; links are made by the workflow's link steps. */
export const writeAttributeValuesStep = createStep(
  "product-attributes-write-values",
  async (plan: ProductAttributesPlan, { container }) => {
    const service = container.resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    const created =
      plan.create.length > 0 ? await service.createAttributeValues(plan.create.map(row)) : []
    if (plan.update.length > 0) {
      await service.updateAttributeValues(
        plan.update.map((change) =>
          row({
            id: change.id,
            value_text: change.value_text,
            value_number: change.value_number,
            value_boolean: change.value_boolean,
            value_options: change.value_options,
          })
        )
      )
    }
    if (plan.remove.length > 0) {
      await service.softDeleteAttributeValues(plan.remove)
    }
    const written: Written = {
      createdIds: created.map((value) => value.id),
      updated: plan.update.map(({ id, previous }) => ({ id, ...previous })),
      removedIds: plan.remove,
    }
    return new StepResponse({ createdIds: written.createdIds }, written)
  },
  async (written: Written | undefined, { container }) => {
    if (!written) {
      return
    }
    const service = container.resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    if (written.createdIds.length > 0) {
      await service.deleteAttributeValues(written.createdIds)
    }
    if (written.updated.length > 0) {
      await service.updateAttributeValues(written.updated.map(row))
    }
    if (written.removedIds.length > 0) {
      await service.restoreAttributeValues(written.removedIds)
    }
  }
)
