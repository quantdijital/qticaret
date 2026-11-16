import type { IOrderModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../lib/logging"
import { PAYMENT_LINKS_MODULE } from "../../modules/payment-links"
import type PaymentLinksModuleService from "../../modules/payment-links/service"
import { alertLink } from "./alerts"
import type { LinkAlert } from "./alerts"
import { CART_LINK_KEY, linkIdOfCart } from "./cart-guard"

type Container = Pick<MedusaContainer, "resolve">

interface OrderRow {
  id: string
  metadata?: Record<string, unknown> | null
  cart?: { id: string; metadata?: Record<string, unknown> | null } | null
}

/** What the step undoes: only the order's keys it wrote, back to their earlier values. */
interface Undo {
  order_id: string
  metadata: Record<string, unknown>
}

/** Who made the link, on the order, for its page ("Ödeme bağlantısından", adr/0051 §13). */
export const ORDER_LINK_BY_KEY = "qt_payment_link_by"
/** The link's number (1042 for `PL-1042`), so the order's page names it without reading the link. */
export const ORDER_LINK_NUMBER_KEY = "qt_payment_link_number"

const service = (container: Container) =>
  container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)

/**
 * The order's keys for its link that are not written yet. Medusa merges
 * metadata by top-level key, so only these are sent and the order's other
 * keys stay as they are.
 */
export function missingMarks(
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

/** The bell, never the step's failure (alertLink logs its own; this catches anything else). */
async function ring(
  container: Container,
  kind: LinkAlert,
  link: Parameters<typeof alertLink>[2],
  orderId: string
) {
  await alertLink(container, kind, link, orderId).catch((error: unknown) => {
    logger.warn({ event: "payment_links.alert_failed", kind, err: errorSummary(error) })
  })
}

const skip = () => new StepResponse<{ paid: boolean }, Undo | null>({ paid: false }, null)

/**
 * Closes the link for this order unless it is paid already (a guarded
 * write: a link another run paid in the meantime is never overwritten).
 * A link closed before (expired, canceled) keeps its `closed_at`. True when
 * this order now holds the link.
 */
async function closeForOrder(
  container: Container,
  link: { id: string; closed_at?: Date | string | null },
  orderId: string
): Promise<boolean> {
  const links = service(container)
  const now = new Date()
  const updated = await links.updatePaymentLinks({
    selector: { id: link.id, status: { $ne: "paid" } },
    data: {
      status: "paid",
      order_id: orderId,
      paid_at: now,
      closed_at: link.closed_at ? new Date(link.closed_at) : now,
    },
  })
  if (updated.length > 0) {
    return true
  }
  const [again] = await links.listPaymentLinks({ id: link.id }, { take: 1 })
  return again?.order_id === orderId
}

/**
 * An order placed from a link's cart (adr/0051 §5). The link is closed
 * first, so a link whose order exists never stays open for a second
 * payment (money first); then the order names the link and who made it
 * (for its page; a failed write is logged and left for the next run or the
 * hourly settle, `settle.ts`); then the bell. A link this order already
 * paid gets the keys it misses; a repeated event finds it all done and
 * does nothing. An order from a cart that was not the link's latest, from
 * a link no longer open, or from a link another order paid, is a possible
 * second charge: staff are told (`needs_review`).
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
    const [link] = await service(container).listPaymentLinks({ id: linkId }, { take: 1 })
    if (!link) {
      return skip()
    }
    let paidHere = link.status === "paid" && link.order_id === order.id
    if (link.status === "paid" && !paidHere) {
      logger.error({ event: "payment_links.paid_twice", linkId, orderId: order.id })
      await ring(container, "needs_review", link, order.id)
      return skip()
    }
    const marks = missingMarks(order.metadata, link)
    if (paidHere && Object.keys(marks).length === 0) {
      return skip()
    }
    if (!paidHere) {
      const odd =
        link.cart_id !== order.cart.id ? "other_cart" : link.status !== "open" ? "not_open" : null
      if (odd) {
        // The completion guard refuses such a cart: the link is closed all the same (its
        // money was taken), and staff look at it
        logger.warn({
          event: "payment_links.paid_unexpected",
          reason: odd,
          linkId,
          orderId: order.id,
          status: link.status,
        })
      }
      paidHere = await closeForOrder(container, link, order.id)
      if (!paidHere) {
        logger.error({ event: "payment_links.paid_twice", linkId, orderId: order.id })
        await ring(container, "needs_review", link, order.id)
        return skip()
      }
      if (odd) {
        await ring(container, "needs_review", link, order.id)
      }
    }
    let undo: Undo | null = null
    if (Object.keys(marks).length > 0) {
      try {
        await container
          .resolve<IOrderModuleService>(Modules.ORDER)
          .updateOrders(order.id, { metadata: marks })
        undo = { order_id: order.id, metadata: earlierValues(order.metadata, marks) }
      } catch (error) {
        // The link stays paid: the next run (or the hourly settle) writes the keys
        logger.error({
          event: "payment_links.order_marks_failed",
          linkId,
          orderId: order.id,
          err: errorSummary(error),
        })
      }
    }
    await ring(container, "paid", link, order.id)
    return new StepResponse<{ paid: boolean }, Undo | null>({ paid: true }, undo)
  },
  // Only the order's keys this step wrote: a paid link is never opened again (its money was taken)
  async (undo, { container }) => {
    // Null (nothing written), or the step's answer where Medusa passes that instead
    if (!undo?.order_id) {
      return
    }
    await container
      .resolve<IOrderModuleService>(Modules.ORDER)
      .updateOrders(undo.order_id, { metadata: undo.metadata })
  }
)

export const markPaymentLinkPaidWorkflow = createWorkflow(
  "payment-links-mark-paid",
  (input: { order_id: string }) => new WorkflowResponse(markLinkPaidStep(input))
)
