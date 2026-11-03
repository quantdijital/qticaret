import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { SEO_REDIRECTS_MODULE } from "../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../modules/seo-redirects/service"
import { readSearchDocumentsStep } from "./steps/read-search-documents"
import { writeSearchDocumentsStep } from "./steps/write-search-documents"

/**
 * A listing's resolve answers hold counts the index gave (a page past the
 * last, filters that leave nothing): every process forgets them once the
 * index changed, and again if the change is undone.
 */
const forgetListingAnswersStep = createStep(
  "search-index-forget-listing-answers",
  async (_input: undefined, { container }) => {
    await container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE).invalidateResolutions()
    return new StepResponse(undefined, true)
  },
  async (done, { container }) => {
    if (done) {
      await container
        .resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
        .invalidateResolutions()
    }
  }
)

/**
 * The search index's one way in (adr/0056): these products' rows made
 * again from the catalogue, the gone ones taken out. Run by the drain
 * (drain.ts), never inside a catalogue write: a save is never slowed or
 * failed by the index.
 */
export const reindexSearchProductsWorkflow = createWorkflow(
  "search-index-reindex",
  (input: { product_ids: string[] }) => {
    const read = readSearchDocumentsStep(input)
    const written = writeSearchDocumentsStep(read)
    forgetListingAnswersStep()
    return new WorkflowResponse(written)
  }
)
