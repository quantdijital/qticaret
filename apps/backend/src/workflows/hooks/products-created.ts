import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { assertProductsWithinLimit, forgetUsage } from "../../lib/plan-limits"
import { claimProductPaths, unclaimPaths } from "../catalog/entity-paths"
import { planCreatedVariantImages, tieImages, untieImages } from "../catalog/variant-image-ties"
import { addBackorderLevels, removeBackorderLevels } from "../stock/backorder-levels"

// Medusa takes one handler per hook: every rule for new products joins here.
// The hook runs after the products are written; throwing undoes them.
// Variants that sell past stock get the stock level checkout needs (F3.8).
// Weight and measures are optional, published or not (adr/0054).
// The variant pictures picked before the product existed are tied to its
// variants in the same save (`additional_data.variant_images`): a picture or
// variant the product lacks is refused before anything is written here.
// adr/0061 Ek C14: past the package's product limit the create is refused
// (403 `plan.limit_reached`), first and before this hook writes anything. Every
// way a product is made runs here: the product route, Medusa's batch, a
// copy, the sheet import and the move from an old site.
createProductsWorkflow.hooks.productsCreated(
  async ({ products, additional_data }, { container }) => {
    const ids = products.map((product) => product.id)
    await assertProductsWithinLimit(container, ids.length)
    const ties = await planCreatedVariantImages(container, ids, additional_data)
    const claims = await claimProductPaths(container, ids)
    const levels = await addBackorderLevels(container, { product_ids: ids })
    try {
      await tieImages(container, ties)
    } catch (failure) {
      // A step that throws is not compensated: what this one wrote is undone here
      await removeBackorderLevels(container, levels)
      await unclaimPaths(container, claims)
      throw failure
    }
    // The panel's count of products is read again, now the write stands (review L3)
    forgetUsage("products")
    return new StepResponse(undefined, { claims, levels, ties })
  },
  async (undo, { container }) => {
    await untieImages(container, undo?.ties ?? [])
    await removeBackorderLevels(container, undo?.levels ?? [])
    await unclaimPaths(container, undo?.claims ?? [])
  }
)
