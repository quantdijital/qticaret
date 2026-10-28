import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"

interface OrderRow {
  id: string
  email: string | null
  customer_id: string | null
  shipping_address?: { phone?: string | null } | null
  cart?: { id: string } | null
}

/**
 * Records the boxes ticked at checkout for the order's own e-mail and
 * phone, with the cart's proof, then lets the cart's row go. An unticked
 * box changes nothing: it is no withdrawal. Nothing to undo: a consent
 * recorded stays a fact, and recording it again is no change.
 */
const recordCheckoutConsentsStep = createStep(
  "messaging-record-checkout-consents",
  async (input: { order_id: string }, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["id", "email", "customer_id", "shipping_address.phone", "cart.id"],
      filters: { id: input.order_id },
    })
    const order = data[0] as OrderRow | undefined
    const cartId = order?.cart?.id
    if (!order || !cartId) {
      return new StepResponse({ recorded: 0 })
    }
    const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
    const [ticked] = await messaging.listCheckoutConsents({ cart_id: cartId }, { take: 1 })
    if (!ticked) {
      return new StepResponse({ recorded: 0 })
    }
    const evidence = {
      text_version: ticked.text_version,
      order_id: order.id,
      cart_id: cartId,
      given_at: new Date(ticked.given_at).toISOString(),
      ...(ticked.ip_hash ? { ip_hash: ticked.ip_hash } : {}),
    }
    const wanted = [
      ticked.email && order.email ? { channel: "email" as const, address: order.email } : null,
      ticked.sms && order.shipping_address?.phone
        ? { channel: "sms" as const, address: order.shipping_address.phone }
        : null,
    ].filter((each) => each !== null)
    let recorded = 0
    for (const { channel, address } of wanted) {
      // An address that is none of the channel's is left out, not an error
      if (messaging.recipientOf(channel, address)) {
        await messaging.recordConsent({
          channel,
          address,
          status: "granted",
          source: "checkout",
          customer_id: order.customer_id,
          evidence,
        })
        recorded += 1
      }
    }
    await messaging.deleteCheckoutConsents([ticked.id])
    return new StepResponse({ recorded })
  }
)

/** adr/0038 §2: consent given at checkout, recorded once the order exists. */
export const recordCheckoutConsentsWorkflow = createWorkflow(
  "messaging-record-checkout-consents",
  (input: { order_id: string }) => new WorkflowResponse(recordCheckoutConsentsStep(input))
)
