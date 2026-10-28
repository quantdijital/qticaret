import type { MedusaContainer } from "@medusajs/framework/types"
import {
  beginReceiveReturnWorkflow,
  beginReturnOrderWorkflow,
  confirmReturnReceiveWorkflow,
  confirmReturnRequestWorkflow,
  createReturnShippingMethodWorkflow,
  receiveItemReturnRequestWorkflow,
  requestItemReturnWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * A return through Medusa's own workflows, as its admin return screens
 * ran them before those routes were closed (adr/0032 §7): asked for and
 * confirmed, with a return shipping at `shipping_amount` (lira) when
 * given, and received unless `receive` is false. The return's id.
 */
export async function medusaReturn(
  container: MedusaContainer,
  input: {
    order_id: string
    location_id: string
    items: { id: string; quantity: number }[]
    shipping?: { option_id: string; amount: number }
    receive?: boolean
  }
): Promise<string> {
  const { result: change } = await beginReturnOrderWorkflow(container).run({
    input: { order_id: input.order_id, location_id: input.location_id },
  })
  const returnId = change.return_id
  await requestItemReturnWorkflow(container).run({
    input: { return_id: returnId, items: input.items },
  })
  if (input.shipping) {
    await createReturnShippingMethodWorkflow(container).run({
      input: {
        return_id: returnId,
        shipping_option_id: input.shipping.option_id,
        custom_amount: input.shipping.amount,
      },
    })
  }
  await confirmReturnRequestWorkflow(container).run({ input: { return_id: returnId } })
  if (input.receive !== false) {
    await beginReceiveReturnWorkflow(container).run({ input: { return_id: returnId } })
    await receiveItemReturnRequestWorkflow(container).run({
      input: { return_id: returnId, items: input.items },
    })
    await confirmReturnReceiveWorkflow(container).run({ input: { return_id: returnId } })
  }
  return returnId
}
