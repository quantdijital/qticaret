import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { createProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"
import { claimCategoryPaths, unclaimPaths } from "../catalog/entity-paths"

// One handler per hook: every rule for new categories joins here
createProductCategoriesWorkflow.hooks.categoriesCreated(
  async ({ categories }, { container }) => {
    const ids = categories.map((category) => category.id)
    return new StepResponse(undefined, await claimCategoryPaths(container, ids))
  },
  async (claims, { container }) => {
    await unclaimPaths(container, claims ?? [])
  }
)
