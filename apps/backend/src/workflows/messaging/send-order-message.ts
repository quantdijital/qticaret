import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { deliver } from "./deliver"
import { loadOrderMessage } from "./loaders/order"

export interface OrderMessageInput {
  order_id: string
  template: "order.placed"
}

/** Reads the order and sends the template's message on its channels; nothing to undo. */
export const sendOrderMessageStep = createStep(
  "messaging-send-order-message",
  async (input: OrderMessageInput, { container }) => {
    const loaded = await loadOrderMessage(container, input.order_id)
    if (!loaded) {
      return new StepResponse({})
    }
    return new StepResponse(
      await deliver(container, {
        template: input.template,
        resource: { type: "order", id: input.order_id },
        recipients: loaded.recipients,
        receiverId: loaded.receiverId,
        vars: loaded.vars,
      })
    )
  }
)

/** A message about an order to its customer (F9.4, adr/0036). */
export const sendOrderMessageWorkflow = createWorkflow(
  "messaging-send-order-message",
  (input: OrderMessageInput) => new WorkflowResponse(sendOrderMessageStep(input))
)
