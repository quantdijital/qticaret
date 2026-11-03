import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { alignProductProfiles, restoreProductProfiles } from "../catalog/align-shipping"
import { claimProductPaths, unclaimPaths } from "../catalog/entity-paths"
import { addBackorderLevels, removeBackorderLevels } from "../stock/backorder-levels"

// Medusa takes one handler per hook: every rule for changed products joins
// here. A replaced path stays reserved and resolution sends it to the new
// one (adr/0017). Variants turned to sell past stock through the product
// get the stock level checkout needs (F3.8). Throwing undoes the update.
// Weight and measures are optional, published or not (adr/0054).
updateProductsWorkflow.hooks.productsUpdated(
  async ({ products }, { container }) => {
    const ids = products.map((product) => product.id)
    const claims = await claimProductPaths(container, ids)
    // F3.2: a digital or service product given a shipping profile again leaves it
    const profiles = await alignProductProfiles(container, ids)
    const levels = await addBackorderLevels(container, { product_ids: ids })
    return new StepResponse(undefined, { claims, profiles, levels })
  },
  async (undo, { container }) => {
    await removeBackorderLevels(container, undo?.levels ?? [])
    await restoreProductProfiles(container, undo?.profiles ?? [])
    await unclaimPaths(container, undo?.claims ?? [])
  }
)
