import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { readSearchDocuments } from "../source"

/** The products' rows as the catalogue holds them now (a read: nothing to undo). */
export const readSearchDocumentsStep = createStep(
  "search-index-read-documents",
  async (input: { product_ids: string[] }, { container }) =>
    new StepResponse(await readSearchDocuments(container, input.product_ids))
)
