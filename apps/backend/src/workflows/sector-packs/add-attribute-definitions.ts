import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { templateLockKey } from "../product-attributes/templates"
import { addAttributeDefinitionsStep } from "./steps/add-attribute-definitions"
import type { AddAttributeDefinitionsInput } from "./steps/add-attribute-definitions"

/**
 * A pack's new attributes added to its template (adr/0061 C12), under the
 * template's lock as every change to it is, so no product save or panel
 * edit meets it half way.
 */
export const addAttributeDefinitionsWorkflow = createWorkflow(
  "sector-packs-add-attribute-definitions",
  (input: AddAttributeDefinitionsInput) => {
    const key = transform({ input }, ({ input }) => templateLockKey(input.template_id))
    acquireLockStep({ key, timeout: 10, ttl: 120 })
    const result = addAttributeDefinitionsStep(input)
    releaseLockStep({ key })
    return new WorkflowResponse(result)
  }
)
