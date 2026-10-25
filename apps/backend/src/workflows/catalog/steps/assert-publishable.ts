import { createStep } from "@medusajs/framework/workflows-sdk"
import { assertPublishable } from "../publish-rules"

/** The publish rule as a step: throws for a published physical product missing measurements. */
export const assertPublishableStep = createStep(
  "catalog-assert-publishable",
  async (input: { product_id: string }, { container }) => {
    await assertPublishable(container, [input.product_id])
  }
)
