import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { alignProductProfiles, restoreProductProfiles } from "../catalog/align-shipping"
import { claimProductPaths, unclaimPaths } from "../catalog/entity-paths"
import { assertPublishable } from "../catalog/publish-rules"

// Medusa takes one handler per hook: every rule for changed products joins
// here. A replaced path stays reserved and resolution sends it to the new
// one (adr/0017). Throwing undoes the update.
updateProductsWorkflow.hooks.productsUpdated(
  async ({ products }, { container }) => {
    const ids = products.map((product) => product.id)
    await assertPublishable(container, ids)
    const claims = await claimProductPaths(container, ids)
    // F3.2: a digital or service product given a shipping profile again leaves it
    const profiles = await alignProductProfiles(container, ids)
    return new StepResponse(undefined, { claims, profiles })
  },
  async (undo, { container }) => {
    await restoreProductProfiles(container, undo?.profiles ?? [])
    await unclaimPaths(container, undo?.claims ?? [])
  }
)
