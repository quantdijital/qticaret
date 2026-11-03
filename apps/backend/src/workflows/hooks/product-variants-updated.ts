import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { alignVariantItems, restoreVariantItems } from "../catalog/align-shipping"
import { addBackorderLevels, removeBackorderLevels } from "../stock/backorder-levels"

// One handler per hook. Turning stock tracking on makes an item that
// requires shipping, which a digital or service product's must not (F3.2);
// a variant turned to sell past stock gets the stock level checkout needs
// (F3.8). Throwing undoes the update. Weight and measures may be cleared,
// published or not (adr/0054).
updateProductVariantsWorkflow.hooks.productVariantsUpdated(
  async ({ product_variants }, { container }) => {
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
