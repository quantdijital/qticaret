import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { createProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { alignVariantItems, restoreVariantItems } from "../catalog/align-shipping"
import { assertPublishable, productIdsOf } from "../catalog/publish-rules"
import { addBackorderLevels, removeBackorderLevels } from "../stock/backorder-levels"

// One handler per hook. A variant added to a published product needs its
// weight and dimensions too; one added to a digital or service product
// needs no shipping (F3.2); one that sells past stock gets the stock level
// checkout needs (F3.8). Throwing undoes the new variants.
createProductVariantsWorkflow.hooks.productVariantsCreated(
  async ({ product_variants }, { container }) => {
    await assertPublishable(container, productIdsOf(product_variants))
    const ids = product_variants.map((variant) => variant.id)
    const changed = await alignVariantItems(container, ids)
    const levels = await addBackorderLevels(container, { variant_ids: ids })
    return new StepResponse(undefined, { changed, levels })
  },
  async (undo, { container }) => {
    await removeBackorderLevels(container, undo?.levels ?? [])
    await restoreVariantItems(container, undo?.changed ?? [])
  }
)
