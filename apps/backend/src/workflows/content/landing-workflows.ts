import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  emitEventStep,
  releaseLockStep,
  removeRemoteLinkStep,
} from "@medusajs/medusa/core-flows"
import { CONTENT_MODULE } from "../../modules/content"
import { CATALOG_ENTITY_TYPES } from "../catalog/entity-paths"
import { releaseEntityPathsStep } from "../catalog/steps/release-entity-paths"
import { attachMediaStep } from "../media/steps/attach-media"
import { forgetResolutionsStep } from "../seo/steps/forget-resolutions"
import { LANDINGS_LOCK } from "./landing-originality"
import { claimLandingPathStep } from "./steps/claim-landing-path"
import { deleteLandingStep } from "./steps/delete-landing"
import { saveLandingStep } from "./steps/save-landing"
import type { SaveLandingInput } from "./steps/save-landing"

/** Emitted after a landing page is saved or deleted: `{ id }`. */
export const LANDING_SAVED = "landing.saved"
export const LANDING_DELETED = "landing.deleted"

/**
 * Creates or changes a facet landing page (F3.16): checked, its text
 * measured against the other landing pages, written, its path claimed
 * under its category's; every step undone if a later one fails.
 */
export const saveLandingWorkflow = createWorkflow(
  "content-save-landing",
  (input: SaveLandingInput) => {
    acquireLockStep(LANDINGS_LOCK)
    const { saved, media } = saveLandingStep(input)
    claimLandingPathStep(
      transform({ saved }, ({ saved }) => ({
        id: saved.id,
        category_id: saved.category_id,
        handle: saved.handle,
        was_live: saved.was_live,
      }))
    )
    attachMediaStep(transform({ media }, ({ media }) => ({ link: media, record: [] })))
    forgetResolutionsStep()
    emitEventStep({
      eventName: LANDING_SAVED,
      data: transform({ saved }, ({ saved }) => ({ id: saved.id })),
    })
    releaseLockStep({ key: LANDINGS_LOCK.key })
    return new WorkflowResponse(saved)
  }
)

/** Deletes a landing page: its path answers 410 if it was ever live, else is freed. */
export const deleteLandingWorkflow = createWorkflow("content-delete-landing", (id: string) => {
  acquireLockStep(LANDINGS_LOCK)
  const deleted = deleteLandingStep(id)
  removeRemoteLinkStep({ [CONTENT_MODULE]: { landing_page_id: id } })
  releaseEntityPathsStep({ entity_type: CATALOG_ENTITY_TYPES.landing, entity_id: id })
  forgetResolutionsStep()
  emitEventStep({ eventName: LANDING_DELETED, data: deleted })
  releaseLockStep({ key: LANDINGS_LOCK.key })
  return new WorkflowResponse(deleted)
})
