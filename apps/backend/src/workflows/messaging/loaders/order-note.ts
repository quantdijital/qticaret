import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../../../lib/logging"
import type { OrderNoteVars } from "../../../lib/messaging/templates"
import { ORDER_NOTES_MODULE } from "../../../modules/order-notes"
import type OrderNotesModuleService from "../../../modules/order-notes/service"
import { loadOrderMessage } from "./order"
import type { Loaded } from "./types"

/**
 * A staff note sent to the order's customer (Batch 9 / O3): the note named
 * by the send (`extra.note_id`), only while it is on this order and not
 * removed; the order's page and address as the order's own message has them.
 */
export async function loadOrderNoteMessage(
  container: Pick<MedusaContainer, "resolve">,
  orderId: string,
  extra: Readonly<Record<string, string>>
): Promise<Loaded<OrderNoteVars> | null> {
  const noteId = extra["note_id"] ?? ""
  const [note] = noteId
    ? await container
        .resolve<OrderNotesModuleService>(ORDER_NOTES_MODULE)
        .listOrderNotes(
          { id: noteId, order_id: orderId, removed_by: null },
          { take: 1, select: ["id", "body"] }
        )
    : []
  if (!note || note.body.trim() === "") {
    logger.info({
      event: "messaging.not_sent",
      template: "order.note",
      reason: "no_note",
    })
    return null
  }
  const order = await loadOrderMessage(container, orderId)
  if (!order) {
    return null
  }
  return {
    vars: {
      number: order.vars.number,
      customerName: order.vars.customerName,
      note: note.body,
      orderUrl: order.vars.orderUrl ?? null,
    },
    recipients: { email: order.recipients.email ?? null },
    receiverId: order.receiverId,
    resourceType: "order",
  }
}
