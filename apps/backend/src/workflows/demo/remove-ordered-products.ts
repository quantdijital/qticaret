import { WorkflowResponse, createWorkflow, when } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import { deleteProductsWorkflow, deleteReservationsWorkflow } from "@medusajs/medusa/core-flows"

export interface RemoveOrderedDemoProductInput {
  product_id: string
  /** The stock its orders still hold: released first, or Medusa keeps the product. */
  reservation_ids: string[]
}

/**
 * A demo product a shopper's order still holds stock for, taken out of a
 * developer's database (`demo:remove products-with-orders`): its
 * reservations released, then the product soft-deleted through Medusa's
 * own workflow (variants, stock and links with it). Each part is Medusa's,
 * with its own undo: a failed delete brings the reservations back. The
 * orders keep their lines as they were written (title, variant, price).
 */
export const removeOrderedDemoProductWorkflow = createWorkflow(
  "demo-remove-ordered-product",
  (input: WorkflowData<RemoveOrderedDemoProductInput>) => {
    when("demo-release-reservations", input, (data) => data.reservation_ids.length > 0).then(() => {
      deleteReservationsWorkflow.runAsStep({ input: { ids: input.reservation_ids } })
    })
    deleteProductsWorkflow.runAsStep({ input: { ids: [input.product_id] } })
    return new WorkflowResponse({ product_id: input.product_id })
  }
)
