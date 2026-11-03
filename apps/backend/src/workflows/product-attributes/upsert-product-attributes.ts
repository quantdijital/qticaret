import { Modules } from "@medusajs/framework/utils"
import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createRemoteLinkStep,
  dismissRemoteLinkStep,
  emitEventStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import { CATALOG_PRODUCT_SAVED } from "../catalog/events"
import { planProductAttributesStep } from "./steps/plan-product-attributes"
import type { UpsertProductAttributesInput } from "./steps/plan-product-attributes"
import { writeAttributeValuesStep } from "./steps/write-attribute-values"
import { templateLockKey } from "./templates"

/**
 * Sets a product's attribute template and values (F2.4, adr/0013). A lock
 * per product keeps one value per product and definition when two saves
 * meet, and the template's lock keeps its definitions from changing under
 * the save; every step undoes itself if a later one fails.
 */
export const upsertProductAttributesWorkflow = createWorkflow(
  "product-attributes-upsert-for-product",
  (input: UpsertProductAttributesInput) => {
    // The product, and the template its values must fit while they are written
    const lockKey = transform({ input }, ({ input }) => [
      `product-attributes:${input.product_id}`,
      ...(input.template_id ? [templateLockKey(input.template_id)] : []),
    ])
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 30 })

    const plan = planProductAttributesStep(input)
    const written = writeAttributeValuesStep(plan)

    const links = transform({ plan, written }, ({ plan, written }) => {
      const product = { [Modules.PRODUCT]: { product_id: plan.product_id } }
      const value = (id: string) => ({
        ...product,
        [PRODUCT_ATTRIBUTES_MODULE]: { attribute_value_id: id },
      })
      const template = (id: string) => ({
        ...product,
        [PRODUCT_ATTRIBUTES_MODULE]: { attribute_template_id: id },
      })
      const changed = plan.template.from !== plan.template.to
      return {
        dismiss: [
          ...plan.remove.map(value),
          ...(changed && plan.template.from ? [template(plan.template.from)] : []),
        ],
        create: [
          ...written.createdIds.map(value),
          ...(changed && plan.template.to ? [template(plan.template.to)] : []),
        ],
      }
    })
    dismissRemoteLinkStep(links.dismiss)
    createRemoteLinkStep(links.create)

    // Search and listings read the values (adr/0056)
    const saved = transform({ input }, ({ input }) => ({ id: input.product_id }))
    emitEventStep({ eventName: CATALOG_PRODUCT_SAVED, data: saved })
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse({ product_id: input.product_id })
  }
)
