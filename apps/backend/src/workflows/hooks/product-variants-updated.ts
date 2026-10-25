import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { alignVariantItems, restoreVariantItems } from "../catalog/align-shipping"
import { assertPublishable, productIdsOf } from "../catalog/publish-rules"

// One handler per hook. Clearing a published product's variant weight or
// dimensions is refused; turning stock tracking on makes an item that
// requires shipping, which a digital or service product's must not (F3.2).
// Throwing undoes the update.
updateProductVariantsWorkflow.hooks.productVariantsUpdated(
  async ({ product_variants }, { container }) => {
    await assertPublishable(container, productIdsOf(product_variants))
    const changed = await alignVariantItems(
      container,
      product_variants.map((variant) => variant.id)
    )
    return new StepResponse(undefined, changed)
  },
  async (changed, { container }) => {
    await restoreVariantItems(container, changed ?? [])
  }
)
