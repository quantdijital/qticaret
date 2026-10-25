import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
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
