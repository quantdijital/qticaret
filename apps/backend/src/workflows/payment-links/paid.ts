import type { IOrderModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { logger } from "../../lib/logging"
import { PAYMENT_LINKS_MODULE } from "../../modules/payment-links"
import type PaymentLinksModuleService from "../../modules/payment-links/service"
import { alertLink } from "./alerts"
import { CART_LINK_KEY, linkIdOfCart } from "./cart-guard"

interface OrderRow {
  id: string
  metadata?: Record<string, unknown> | null
  cart?: { id: string; metadata?: Record<string, unknown> | null } | null
}

/** Who made the link, on the order, for its page ("Ödeme bağlantısından", adr/0051 §13). */
export const ORDER_LINK_BY_KEY = "qt_payment_link_by"

/**
 * An order placed from a link's cart (adr/0051 §5): the link is paid and
 * names the order, the order names the link and who made it, and staff
 * hear of it in the bell. Once: a second event finds it paid already.
 */
const markLinkPaidStep = createStep(
  "payment-links-mark-paid",
  async (input: { order_id: string }, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["id", "metadata", "cart.id", "cart.metadata"],
      filters: { id: input.order_id },
    })
    const order = data[0] as OrderRow | undefined
    const linkId = linkIdOfCart(order?.cart?.metadata)
    if (!order?.cart || !linkId) {
      return new StepResponse({ paid: false })
    }
    const links = container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)
    const [link] = await links.listPaymentLinks({ id: linkId }, { take: 1 })
    if (!link || link.status === "paid") {
      return new StepResponse({ paid: false })
    }
    if (link.cart_id !== order.cart.id) {
      // The completion guard refuses such a cart: an order from one is worth a look
      logger.error({ event: "payment_links.paid_from_other_cart", linkId, orderId: order.id })
      return new StepResponse({ paid: false })
    }
    const now = new Date()
    await links.updatePaymentLinks({
      id: link.id,
      status: "paid",
      order_id: order.id,
      paid_at: now,
      closed_at: now,
    })
    await container.resolve<IOrderModuleService>(Modules.ORDER).updateOrders(order.id, {
      metadata: {
        ...(order.metadata ?? {}),
        [CART_LINK_KEY]: link.id,
        [ORDER_LINK_BY_KEY]: link.created_by,
      },
    })
    await alertLink(container, "paid", link, order.id)
    return new StepResponse({ paid: true })
  }
)

export const markPaymentLinkPaidWorkflow = createWorkflow(
  "payment-links-mark-paid",
  (input: { order_id: string }) => new WorkflowResponse(markLinkPaidStep(input))
)
