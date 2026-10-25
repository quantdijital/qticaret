import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { assertPublishable, productIdsOf } from "../catalog/publish-rules"

// One handler per hook. Clearing a published product's variant weight or
// dimensions is refused; throwing undoes the update.
updateProductVariantsWorkflow.hooks.productVariantsUpdated(
  async ({ product_variants }, { container }) => {
    await assertPublishable(container, productIdsOf(product_variants))
  }
)
