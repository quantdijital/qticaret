import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ORDER_NOTE_KEY, withOrderNote } from "../../../lib/orders/customer-note"

type Container = Pick<MedusaContainer, "resolve">

interface NoteRow {
  id: string
  metadata?: Record<string, unknown> | null
  cart?: { id: string; metadata?: Record<string, unknown> | null } | null
}

// An emptied note ("") is none: run again, erasure changes nothing more
const holds = (metadata: Record<string, unknown> | null | undefined): boolean => {
  const note = metadata?.[ORDER_NOTE_KEY]
  return typeof note === "string" && note !== ""
}

/**
 * The shopper's order notes (Batch 8 / O1) go with the rest of what they
 * wrote: off each order's metadata and off the cart it came from. Run
 * again, it changes nothing more.
 */
export async function eraseOrderNotes(container: Container, orderIds: readonly string[]) {
  if (orderIds.length === 0) {
    return 0
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "metadata", "cart.id", "cart.metadata"],
    filters: { id: [...orderIds] },
  })
  const rows = data as NoteRow[]
  const orders = container.resolve(Modules.ORDER)
  const carts = container.resolve(Modules.CART)
  let erased = 0
  for (const row of rows) {
    if (holds(row.metadata)) {
      await orders.updateOrders(row.id, { metadata: withOrderNote(row.metadata, "") })
      erased += 1
    }
    if (row.cart && holds(row.cart.metadata)) {
      await carts.updateCarts(row.cart.id, { metadata: withOrderNote(row.cart.metadata, "") })
    }
  }
  return erased
}
