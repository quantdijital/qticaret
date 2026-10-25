import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { createProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { alignVariantItems, restoreVariantItems } from "../catalog/align-shipping"
import { assertPublishable, productIdsOf } from "../catalog/publish-rules"

// One handler per hook. A variant added to a published product needs its
// weight and dimensions too; one added to a digital or service product
// needs no shipping (F3.2). Throwing undoes the new variants.
createProductVariantsWorkflow.hooks.productVariantsCreated(
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
