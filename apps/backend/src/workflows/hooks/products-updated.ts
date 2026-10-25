import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { claimProductPaths, unclaimPaths } from "../catalog/entity-paths"
import { assertPublishable } from "../catalog/publish-rules"

// Medusa takes one handler per hook: every rule for changed products joins
// here (redirects from replaced paths come in F3 T3). Throwing undoes the update.
updateProductsWorkflow.hooks.productsUpdated(
  async ({ products }, { container }) => {
    const ids = products.map((product) => product.id)
    await assertPublishable(container, ids)
    return new StepResponse(undefined, await claimProductPaths(container, ids))
  },
  async (claims, { container }) => {
    await unclaimPaths(container, claims ?? [])
  }
)
