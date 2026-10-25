import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createRemoteLinkStep,
  dismissRemoteLinkStep,
  emitEventStep,
  releaseLockStep,
  removeRemoteLinkStep,
} from "@medusajs/medusa/core-flows"
import { BRANDS_MODULE } from "../../modules/brands"
import { releaseEntityPathsStep } from "../catalog/steps/release-entity-paths"
import { CATALOG_ENTITY_TYPES } from "../catalog/entity-paths"
import { forgetResolutionsStep } from "../seo/steps/forget-resolutions"
import { claimBrandPathStep } from "./steps/claim-brand-path"
import { deleteBrandStep } from "./steps/delete-brand"
import { planProductBrandStep } from "./steps/plan-product-brand"
import type { SetProductBrandInput } from "./steps/plan-product-brand"
import { saveBrandStep } from "./steps/save-brand"
import type { SaveBrandInput } from "./steps/save-brand"

/** Emitted after a brand is saved or deleted: `{ id }`. */
export const BRAND_SAVED = "brand.saved"
export const BRAND_DELETED = "brand.deleted"

// One lock for brand saves: two brands taking one name or handle at once
const BRANDS_LOCK = { key: "brands", timeout: 10, ttl: 60 }

/**
 * Creates or changes a brand (F3.11): checked, written, its page path
 * claimed (a changed handle leaves the old path to answer with a 301);
 * every step undone if a later one fails.
 */
export const saveBrandWorkflow = createWorkflow("brands-save-brand", (input: SaveBrandInput) => {
  acquireLockStep(BRANDS_LOCK)
  const saved = saveBrandStep(input)
  claimBrandPathStep(saved)
  forgetResolutionsStep()
  const event = transform({ saved }, ({ saved }) => ({ id: saved.id }))
  emitEventStep({ eventName: BRAND_SAVED, data: event })
  releaseLockStep({ key: BRANDS_LOCK.key })
  return new WorkflowResponse(saved)
})

/**
 * Deletes a brand: its products keep existing without it, its SEO fields
 * go with it, its path stays reserved and answers 410 (adr/0017).
 */
export const deleteBrandWorkflow = createWorkflow("brands-delete-brand", (id: string) => {
  const deleted = deleteBrandStep(id)
  removeRemoteLinkStep({ [BRANDS_MODULE]: { brand_id: id } })
  const owner = transform({ id }, ({ id }) => ({
    entity_type: CATALOG_ENTITY_TYPES.brand,
    entity_id: id,
  }))
  releaseEntityPathsStep(owner)
  forgetResolutionsStep()
  emitEventStep({ eventName: BRAND_DELETED, data: { id } })
  return new WorkflowResponse(deleted)
})

/** Sets a product's brand, or takes it off; one save per product at a time. */
export const setProductBrandWorkflow = createWorkflow(
  "brands-set-product-brand",
  (input: SetProductBrandInput) => {
    const key = transform({ input }, ({ input }) => `brands:product:${input.product_id}`)
    acquireLockStep({ key, timeout: 10, ttl: 30 })
    const plan = planProductBrandStep(input)
    const dismiss = transform({ plan }, ({ plan }) => plan.dismiss)
    const create = transform({ plan }, ({ plan }) => plan.create)
    dismissRemoteLinkStep(dismiss)
    createRemoteLinkStep(create)
    forgetResolutionsStep()
    releaseLockStep({ key })
    return new WorkflowResponse(undefined)
  }
)
