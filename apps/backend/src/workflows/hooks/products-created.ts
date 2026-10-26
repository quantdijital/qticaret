import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { claimProductPaths, unclaimPaths } from "../catalog/entity-paths"
import { assertPublishable } from "../catalog/publish-rules"
import { addBackorderLevels, removeBackorderLevels } from "../stock/backorder-levels"

// Medusa takes one handler per hook: every rule for new products joins here.
// The hook runs after the products are written; throwing undoes them.
// Variants that sell past stock get the stock level checkout needs (F3.8).
createProductsWorkflow.hooks.productsCreated(
  async ({ products }, { container }) => {
    const ids = products.map((product) => product.id)
    await assertPublishable(container, ids)
    const claims = await claimProductPaths(container, ids)
    const levels = await addBackorderLevels(container, { product_ids: ids })
    return new StepResponse(undefined, { claims, levels })
  },
  async (undo, { container }) => {
    await removeBackorderLevels(container, undo?.levels ?? [])
    await unclaimPaths(container, undo?.claims ?? [])
  }
)
