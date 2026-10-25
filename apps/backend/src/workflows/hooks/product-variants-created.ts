import { createProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { assertPublishable, productIdsOf } from "../catalog/publish-rules"

// One handler per hook. A variant added to a published product needs its
// weight and dimensions too; throwing undoes the new variants.
createProductVariantsWorkflow.hooks.productVariantsCreated(
  async ({ product_variants }, { container }) => {
    await assertPublishable(container, productIdsOf(product_variants))
  }
)
