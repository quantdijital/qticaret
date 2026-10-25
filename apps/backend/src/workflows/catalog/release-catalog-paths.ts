import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { UrlOwner } from "../../modules/url-registry/validation"
import { releaseEntityPathsStep } from "./steps/release-entity-paths"

/**
 * The paths of a deleted product, category or collection (docs/13 §2.1):
 * kept reserved so no other record takes the URL while a redirect or a 410
 * may still answer for it (F3 T3); an unpublished product's are freed. Run
 * again, it finds nothing left to release. The step's compensation serves
 * a workflow that nests this one.
 */
export const releaseCatalogPathsWorkflow = createWorkflow(
  "catalog-release-paths",
  (owner: UrlOwner) => {
    releaseEntityPathsStep(owner)
    return new WorkflowResponse(undefined)
  }
)
