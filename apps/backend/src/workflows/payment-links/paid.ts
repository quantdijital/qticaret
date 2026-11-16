import type { IOrderModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../lib/logging"
import type { PaymentLinkStatus } from "../../lib/payment-links/snapshot"
import { PAYMENT_LINKS_MODULE } from "../../modules/payment-links"
import type PaymentLinksModuleService from "../../modules/payment-links/service"
import { alertLink } from "./alerts"
import { CART_LINK_KEY, linkIdOfCart } from "./cart-guard"

interface OrderRow {
  id: string
  metadata?: Record<string, unknown> | null
  cart?: { id: string; metadata?: Record<string, unknown> | null } | null
}

/** The link as it was before this step marked it paid. */
interface LinkBefore {
  id: string
  status: PaymentLinkStatus
  order_id: string | null
  paid_at: Date | string | null
  closed_at: Date | string | null
}

/** What the step undoes: the order's keys it wrote (their earlier values) and the link it marked. */
interface Undo {
  order_id: string
  metadata: Record<string, unknown> | null
  link: LinkBefore | null
}

/** Who made the link, on the order, for its page ("Ödeme bağlantısından", adr/0051 §13). */
export const ORDER_LINK_BY_KEY = "qt_payment_link_by"
/** The link's number (1042 for `PL-1042`), so the order's page names it without reading the link. */
export const ORDER_LINK_NUMBER_KEY = "qt_payment_link_number"

/**
 * The order's keys for its link that are not written yet. Medusa merges
 * metadata by top-level key, so only these are sent and the order's other
 * keys stay as they are.
 */
function missingMarks(
  metadata: Record<string, unknown> | null | undefined,
  link: { id: string; number: number; created_by: string }
): Record<string, unknown> {
  const wanted: Record<string, unknown> = {
    [CART_LINK_KEY]: link.id,
    [ORDER_LINK_NUMBER_KEY]: link.number,
    [ORDER_LINK_BY_KEY]: link.created_by,
  }
  return Object.fromEntries(
    Object.entries(wanted).filter(([key, value]) => metadata?.[key] !== value)
  )
}

/** The earlier values of the written keys; "" removes a key the order did not have (Medusa's rule). */
function earlierValues(
  metadata: Record<string, unknown> | null | undefined,
  marks: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(marks).map((key) => [key, metadata && key in metadata ? metadata[key] : ""])
  )
}

const skip = () => new StepResponse<{ paid: boolean }, Undo | null>({ paid: false }, null)

/**
 * An order placed from a link's cart (adr/0051 §5): the order names the link
 * and who made it, the link is paid and names the order, and staff hear of
 * it in the bell. The order's keys are written first, so a step cut short
 * leaves the link open and the next run does it all again. A link already
 * paid by this order whose keys are missing (a run cut short before this
 * order of writes) gets them; a repeated event finds it all done and does
 * nothing. The bell is one per link (its idempotency key).
 */
export const markLinkPaidStep = createStep(
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
      return skip()
    }
    const links = container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)
    const [link] = await links.listPaymentLinks({ id: linkId }, { take: 1 })
    const paidHere = link?.status === "paid" && link.order_id === order.id
    if (!link || (link.status === "paid" && !paidHere)) {
      return skip()
    }
    if (!paidHere && link.cart_id !== order.cart.id) {
      // The completion guard refuses such a cart: an order from one is worth a look
      logger.error({ event: "payment_links.paid_from_other_cart", linkId, orderId: order.id })
      return skip()
    }
    const marks = missingMarks(order.metadata, link)
    if (paidHere && Object.keys(marks).length === 0) {
      return skip()
    }
    const undo: Undo = { order_id: order.id, metadata: null, link: null }
    try {
      if (Object.keys(marks).length > 0) {
        await container
          .resolve<IOrderModuleService>(Modules.ORDER)
          .updateOrders(order.id, { metadata: marks })
        undo.metadata = earlierValues(order.metadata, marks)
      }
      if (!paidHere) {
        const now = new Date()
        await links.updatePaymentLinks({
          id: link.id,
          status: "paid",
          order_id: order.id,
          paid_at: now,
          closed_at: now,
        })
        undo.link = {
          id: link.id,
          status: link.status,
          order_id: link.order_id ?? null,
          paid_at: link.paid_at ?? null,
          closed_at: link.closed_at ?? null,
        }
      }
    } catch (error) {
      logger.error({
        event: "payment_links.mark_paid_failed",
        linkId,
        orderId: order.id,
        err: errorSummary(error),
      })
      // Undo what was written, so the next run starts from the same place
      return StepResponse.permanentFailure("payment_links.mark_paid_failed", undo)
    }
    await alertLink(container, "paid", link, order.id)
    return new StepResponse<{ paid: boolean }, Undo | null>({ paid: true }, undo)
  },
  async (undo, { container }) => {
    if (!undo?.order_id) {
      return
    }
    if (undo.link) {
      const { id, status, order_id, paid_at, closed_at } = undo.link
      await container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE).updatePaymentLinks({
        id,
        status,
        order_id,
        paid_at: paid_at === null ? null : new Date(paid_at),
        closed_at: closed_at === null ? null : new Date(closed_at),
      })
    }
    if (undo.metadata) {
      await container
        .resolve<IOrderModuleService>(Modules.ORDER)
        .updateOrders(undo.order_id, { metadata: undo.metadata })
    }
  }
)

export const markPaymentLinkPaidWorkflow = createWorkflow(
  "payment-links-mark-paid",
  (input: { order_id: string }) => new WorkflowResponse(markLinkPaidStep(input))
)
