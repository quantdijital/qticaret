import { Modules } from "@medusajs/framework/utils"
import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  dismissRemoteLinkStep,
  emitEventStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import { CATALOG_PRODUCT_SAVED } from "../catalog/events"
import { convertAttributeDefinitionStep } from "./steps/convert-attribute-definition"
import type { ConvertAttributeDefinitionInput } from "./steps/convert-attribute-definition"
import { createAttributeTemplateStep } from "./steps/create-attribute-template"
import type { CreateAttributeTemplateInput } from "./steps/create-attribute-template"
import { deleteAttributeTemplateStep } from "./steps/delete-attribute-template"
import { updateAttributeTemplateStep } from "./steps/update-attribute-template"
import type { UpdateAttributeTemplateInput } from "./steps/update-attribute-template"

/** The lock a template's changes and the saves of products using it share. */
export const templateLockKey = (templateId: string): string =>
  `product-attributes:template:${templateId}`

/** Attribute template workflows (F2.4, adr/0013); each undoes itself if a later step fails. */
export const createAttributeTemplateWorkflow = createWorkflow(
  "product-attributes-create-template",
  (input: CreateAttributeTemplateInput) => new WorkflowResponse(createAttributeTemplateStep(input))
)

export const updateAttributeTemplateWorkflow = createWorkflow(
  "product-attributes-update-template",
  (input: UpdateAttributeTemplateInput) => {
    const key = transform({ input }, ({ input }) => templateLockKey(input.id))
    acquireLockStep({ key, timeout: 10, ttl: 120 })
    const result = updateAttributeTemplateStep(input)
    releaseLockStep({ key })
    return new WorkflowResponse(result)
  }
)

export const deleteAttributeTemplateWorkflow = createWorkflow(
  "product-attributes-delete-template",
  (input: { id: string }) => {
    const key = transform({ input }, ({ input }) => templateLockKey(input.id))
    acquireLockStep({ key, timeout: 10, ttl: 60 })
    const result = deleteAttributeTemplateStep(input.id)
    releaseLockStep({ key })
    return new WorkflowResponse(result)
  }
)

/**
 * A text attribute with values turned into a single choice (adr/0013 Ek
 * 2026-11-05) under the template's lock, so no product save meets it half
 * way: the definition and its values, the cleared values' links, then the
 * products for search and listings (adr/0056).
 */
export const convertAttributeDefinitionWorkflow = createWorkflow(
  "product-attributes-convert-definition",
  (input: ConvertAttributeDefinitionInput) => {
    const key = transform({ input }, ({ input }) => templateLockKey(input.template_id))
    acquireLockStep({ key, timeout: 10, ttl: 120 })
    const converted = convertAttributeDefinitionStep(input)
    const dismiss = transform({ converted }, ({ converted }) =>
      converted.cleared.map((link) => ({
        [Modules.PRODUCT]: { product_id: link.product_id },
        [PRODUCT_ATTRIBUTES_MODULE]: { attribute_value_id: link.attribute_value_id },
      }))
    )
    dismissRemoteLinkStep(dismiss)
    const saved = transform({ converted }, ({ converted }) => ({ id: converted.product_ids }))
    emitEventStep({ eventName: CATALOG_PRODUCT_SAVED, data: saved })
    releaseLockStep({ key })
    return new WorkflowResponse(converted)
  }
)
