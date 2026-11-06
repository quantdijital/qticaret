import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep, removeRemoteLinkStep } from "@medusajs/medusa/core-flows"
import { CONTENT_MODULE } from "../../modules/content"
import { CATALOG_ENTITY_TYPES } from "../catalog/entity-paths"
import { attachMediaStep } from "../media/steps/attach-media"
import { forgetResolutionsStep } from "../seo/steps/forget-resolutions"
import { refreshStorefrontStep } from "../storefront/steps/refresh-storefront"
import { claimAuthorPathStep } from "./steps/claim-author-path"
import { deleteAuthorStep } from "./steps/delete-author"
import { releaseTermPathStep } from "./steps/release-term-path"
import { saveAuthorStep } from "./steps/save-author"
import type { SaveAuthorInput } from "./steps/save-author"
import { CONTENT_LOCK } from "./workflows"

/**
 * Creates or changes a blog author (adr/0060): checked, written, their
 * page's path claimed (a changed handle of an author with live posts
 * leaves the old path to answer with a 301), their photo kept; undone if a
 * later step fails. Their posts' bylines and structured data follow at
 * once: resolve answers are forgotten and the storefront refreshed.
 */
export const saveAuthorWorkflow = createWorkflow(
  "content-save-author",
  (input: SaveAuthorInput) => {
    acquireLockStep(CONTENT_LOCK)
    const { saved, media } = saveAuthorStep(input)
    claimAuthorPathStep(saved)
    attachMediaStep(transform({ media }, ({ media }) => ({ link: media, record: [] })))
    forgetResolutionsStep()
    releaseLockStep({ key: CONTENT_LOCK.key })
    refreshStorefrontStep(["content"])
    return new WorkflowResponse(saved)
  }
)

/**
 * After posts were linked to authors outside a save (`authors:backfill`):
 * their bylines and structured data change, so resolve answers are
 * forgotten and the storefront refreshed.
 */
export const authorsLinkedWorkflow = createWorkflow("content-authors-linked", () => {
  forgetResolutionsStep()
  refreshStorefrontStep(["content"])
  return new WorkflowResponse(undefined)
})

/**
 * Deletes a blog author, never refused for their posts: the posts are
 * left without one. Their SEO fields go with them; their page's path
 * answers 410 if it showed posts, else is freed.
 */
export const deleteAuthorWorkflow = createWorkflow("content-delete-author", (id: string) => {
  acquireLockStep(CONTENT_LOCK)
  const deleted = deleteAuthorStep(id)
  removeRemoteLinkStep({ [CONTENT_MODULE]: { content_author_id: id } })
  const release = transform({ deleted }, ({ deleted }) => ({
    owner: { entity_type: CATALOG_ENTITY_TYPES.post_author, entity_id: deleted.id },
    was_live: deleted.was_live,
  }))
  releaseTermPathStep(release)
  forgetResolutionsStep()
  releaseLockStep({ key: CONTENT_LOCK.key })
  refreshStorefrontStep(["content"])
  return new WorkflowResponse(deleted)
})
