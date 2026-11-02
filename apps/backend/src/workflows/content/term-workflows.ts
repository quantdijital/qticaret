import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep, removeRemoteLinkStep } from "@medusajs/medusa/core-flows"
import { CONTENT_MODULE } from "../../modules/content"
import { forgetResolutionsStep } from "../seo/steps/forget-resolutions"
import { termEntityType } from "./paths"
import { claimTermPathStep } from "./steps/claim-term-path"
import { deleteTermStep } from "./steps/delete-term"
import { releaseTermPathStep } from "./steps/release-term-path"
import { saveTermStep } from "./steps/save-term"
import type { SaveTermInput } from "./steps/save-term"
import { CONTENT_LOCK } from "./workflows"

/**
 * Creates or changes a blog category or tag (adr/0019 ek 2026-11-03):
 * checked, written, its archive path claimed (a renamed archive that had
 * posts leaves its old path to answer with a 301); undone if a later step
 * fails. Under the content lock: a post filed under it at once waits.
 */
export const saveTermWorkflow = createWorkflow("content-save-term", (input: SaveTermInput) => {
  acquireLockStep(CONTENT_LOCK)
  const saved = saveTermStep(input)
  claimTermPathStep(saved)
  forgetResolutionsStep()
  releaseLockStep({ key: CONTENT_LOCK.key })
  return new WorkflowResponse(saved)
})

/**
 * Deletes a blog category or tag, never refused for its posts: a
 * category's posts become uncategorised, a tag's lose it. Its SEO fields
 * go with it; its archive path answers 410 if it showed posts, else is
 * freed.
 */
export const deleteTermWorkflow = createWorkflow("content-delete-term", (id: string) => {
  acquireLockStep(CONTENT_LOCK)
  const deleted = deleteTermStep(id)
  removeRemoteLinkStep({ [CONTENT_MODULE]: { content_term_id: id } })
  const release = transform({ deleted }, ({ deleted }) => ({
    owner: { entity_type: termEntityType(deleted.kind), entity_id: deleted.id },
    was_live: deleted.was_live,
  }))
  releaseTermPathStep(release)
  forgetResolutionsStep()
  releaseLockStep({ key: CONTENT_LOCK.key })
  return new WorkflowResponse(deleted)
})
