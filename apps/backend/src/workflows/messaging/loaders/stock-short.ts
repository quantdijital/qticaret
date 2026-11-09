import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { panelUrl } from "../../../lib/env"
import type { StaffStockShortVars } from "../../../lib/messaging/templates"
import { stockShortOf } from "../../../lib/stock"
import type { Loaded } from "./types"

/** A paid order placed short of stock, as its mark on the order names it (adr/0026 Ek 2026-11-06). */
export async function loadStaffStockShort(
  container: Pick<MedusaContainer, "resolve">,
  orderId: string
): Promise<Loaded<StaffStockShortVars> | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
    filters: { id: orderId },
  })
  const order = data[0] as
    | { id: string; display_id: number | string; metadata?: Record<string, unknown> | null }
    | undefined
  const short = stockShortOf(order?.metadata)
  if (!order || !short) {
    return null
  }
  return {
    vars: {
      number: String(order.display_id),
      lines: short.lines.map(({ title, quantity, short: missing }) => ({
        title,
        quantity,
        short: missing,
      })),
      orderUrl: `${panelUrl()}/orders/${encodeURIComponent(order.id)}`,
    },
    // Staff alerts go to the staff list the send reads: the loader names no recipient
    recipients: {},
    receiverId: null,
    resourceType: "order",
  }
}
