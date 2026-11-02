import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  emitEventStep,
  releaseLockStep,
  removeRemoteLinkStep,
} from "@medusajs/medusa/core-flows"
import { CONTENT_MODULE } from "../../modules/content"
import { releaseEntityPathsStep } from "../catalog/steps/release-entity-paths"
import { attachMediaStep } from "../media/steps/attach-media"
import { forgetResolutionsStep } from "../seo/steps/forget-resolutions"
import { claimContentPathStep } from "./steps/claim-content-path"
import { deleteContentStep } from "./steps/delete-content"
import { saveContentStep } from "./steps/save-content"
import type { SaveContentInput } from "./steps/save-content"
import { setPostTermsStep, unlinkEntryTermsStep } from "./steps/set-post-terms"

/** Emitted after a content entry is saved or deleted: `{ id, kind }`. */
export const CONTENT_SAVED = "content.saved"
export const CONTENT_DELETED = "content.deleted"

// One lock for content saves: two entries taking one handle at once, a post
// filed under a term being deleted
export const CONTENT_LOCK = { key: "content", timeout: 10, ttl: 60 }

/**
 * Creates or changes a content page or blog post (F3.16): checked, written,
 * its path claimed (a changed handle leaves the old path to answer with a
 * 301), a post filed under its category and tags, its images kept; every
 * step undone if a later one fails.
 */
export const saveContentWorkflow = createWorkflow(
  "content-save-entry",
  (input: SaveContentInput) => {
    acquireLockStep(CONTENT_LOCK)
    const { saved, media } = saveContentStep(input)
    claimContentPathStep(saved)
    setPostTermsStep(
      transform({ input, saved }, ({ input, saved }) => ({
        entry_id: saved.id,
        kind: saved.kind,
        terms: input.terms,
      }))
    )
    attachMediaStep(transform({ media }, ({ media }) => ({ link: media, record: [] })))
    forgetResolutionsStep()
    const event = transform({ saved }, ({ saved }) => ({ id: saved.id, kind: saved.kind }))
    emitEventStep({ eventName: CONTENT_SAVED, data: event })
    releaseLockStep({ key: CONTENT_LOCK.key })
    return new WorkflowResponse(saved)
  }
)

/**
 * Deletes a content entry: its SEO fields go with it, its path stays
 * reserved and answers 410 if it was ever live (adr/0017), else is freed.
 */
export const deleteContentWorkflow = createWorkflow("content-delete-entry", (id: string) => {
  // A save of the same entry at once would claim its path again after the release
  acquireLockStep(CONTENT_LOCK)
  const deleted = deleteContentStep(id)
  unlinkEntryTermsStep(id)
  removeRemoteLinkStep({ [CONTENT_MODULE]: { content_entry_id: id } })
  const owner = transform({ deleted }, ({ deleted }) => ({
    entity_type: deleted.kind,
    entity_id: deleted.id,
  }))
  releaseEntityPathsStep(owner)
  forgetResolutionsStep()
  emitEventStep({ eventName: CONTENT_DELETED, data: deleted })
  releaseLockStep({ key: CONTENT_LOCK.key })
  return new WorkflowResponse(deleted)
})
