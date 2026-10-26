import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { updateProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"
import { claimCategoryPaths, unclaimPaths } from "../catalog/entity-paths"
import { claimLandingsBelow } from "../content/landing-paths"

// One handler per hook. A renamed or moved category changes its path and
// every path below it, its landing pages' too (F3.16): each old path stays
// for its 301. A hook that fails is not compensated: it undoes its own
// claims before it fails.
updateProductCategoriesWorkflow.hooks.categoriesUpdated(
  async ({ categories }, { container }) => {
    const ids = categories.map((category) => category.id)
    const claims = await claimCategoryPaths(container, ids)
    // No category path moved: no landing page's either
    if (claims.length > 0) {
      try {
        claims.push(...(await claimLandingsBelow(container, ids)))
      } catch (error) {
        await unclaimPaths(container, claims)
        throw error
      }
    }
    return new StepResponse(undefined, claims)
  },
  async (claims, { container }) => {
    await unclaimPaths(container, claims ?? [])
  }
)
