import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { updateProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"
import { claimCategoryPaths, unclaimPaths } from "../catalog/entity-paths"

// One handler per hook. A renamed or moved category changes its path and
// every path below it (subtree redirects come in F3 T3).
updateProductCategoriesWorkflow.hooks.categoriesUpdated(
  async ({ categories }, { container }) => {
    const ids = categories.map((category) => category.id)
    return new StepResponse(undefined, await claimCategoryPaths(container, ids))
  },
  async (claims, { container }) => {
    await unclaimPaths(container, claims ?? [])
  }
)
