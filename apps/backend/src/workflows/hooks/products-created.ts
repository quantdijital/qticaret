import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { claimProductPaths, unclaimPaths } from "../catalog/entity-paths"
import { assertPublishable } from "../catalog/publish-rules"

// Medusa takes one handler per hook: every rule for new products joins here.
// The hook runs after the products are written; throwing undoes them.
createProductsWorkflow.hooks.productsCreated(
  async ({ products }, { container }) => {
    const ids = products.map((product) => product.id)
    await assertPublishable(container, ids)
    return new StepResponse(undefined, await claimProductPaths(container, ids))
  },
  async (claims, { container }) => {
    await unclaimPaths(container, claims ?? [])
  }
)
