import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createRemoteLinkStep,
  dismissRemoteLinkStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { templateLockKey } from "../product-attributes/templates"
import { planProductAddonTemplatesStep } from "./product-links"
import type { SetProductAddonTemplatesInput } from "./product-links"
import {
  addonTemplateLinksStep,
  carryAddonTemplatesStep,
  createAddonTemplateStep,
  deleteAddonTemplateStep,
  uncarryAddonTemplateStep,
  updateAddonTemplateStep,
} from "./steps"
import type { AddonTemplateInput, CarryInput, UpdateAddonTemplateInput } from "./steps"

/**
 * Add-on templates (adr/0052 Ek 2026-11-23): add-ons defined once,
 * linked to products live. Each workflow undoes itself if a later step
 * fails. A template's changes take its lock; a product's links take the
 * product's catalog lock, which its own add-ons' save takes too, so the
 * limit of five is checked against what is there.
 */

export const addonTemplateLockKey = (id: string): string => `addon-templates:${id}`

export const createAddonTemplateWorkflow = createWorkflow(
  "addon-templates-create",
  (input: AddonTemplateInput) => new WorkflowResponse(createAddonTemplateStep(input))
)

export const updateAddonTemplateWorkflow = createWorkflow(
  "addon-templates-update",
  (input: UpdateAddonTemplateInput) => {
    const key = transform({ input }, ({ input }) => addonTemplateLockKey(input.id))
    acquireLockStep({ key, timeout: 10, ttl: 120 })
    const result = updateAddonTemplateStep(input)
    releaseLockStep({ key })
    return new WorkflowResponse(result)
  }
)

/**
 * Deletes a template, in use or not: its product links go, attribute
 * templates stop carrying it. Carts holding its add-ons stop at checkout
 * (`addons.unavailable`); orders keep what they recorded.
 */
export const deleteAddonTemplateWorkflow = createWorkflow(
  "addon-templates-delete",
  (input: { id: string }) => {
    const key = transform({ input }, ({ input }) => addonTemplateLockKey(input.id))
    acquireLockStep({ key, timeout: 10, ttl: 120 })
    const links = addonTemplateLinksStep(input.id)
    dismissRemoteLinkStep(links)
    uncarryAddonTemplateStep(input.id)
    const result = deleteAddonTemplateStep(input.id)
    releaseLockStep({ key })
    return new WorkflowResponse(result)
  }
)

/** The add-on templates linked to a product, as a whole list. */
export const setProductAddonTemplatesWorkflow = createWorkflow(
  "addon-templates-set-product",
  (input: SetProductAddonTemplatesInput) => {
    const key = transform({ input }, ({ input }) => `catalog:${input.product_id}`)
    acquireLockStep({ key, timeout: 10, ttl: 30 })
    const plan = planProductAddonTemplatesStep(input)
    const create = transform({ plan }, ({ plan }) => plan.create)
    const dismiss = transform({ plan }, ({ plan }) => plan.dismiss)
    createRemoteLinkStep(create)
    dismissRemoteLinkStep(dismiss)
    releaseLockStep({ key })
    return new WorkflowResponse(
      transform({ plan }, ({ plan }) => ({ before: plan.before, after: plan.after }))
    )
  }
)

/** The add-on templates an attribute template carries, under that template's lock. */
export const carryAddonTemplatesWorkflow = createWorkflow(
  "addon-templates-carry",
  (input: CarryInput) => {
    const key = transform({ input }, ({ input }) => templateLockKey(input.attribute_template_id))
    acquireLockStep({ key, timeout: 10, ttl: 120 })
    const result = carryAddonTemplatesStep(input)
    releaseLockStep({ key })
    return new WorkflowResponse(result)
  }
)
