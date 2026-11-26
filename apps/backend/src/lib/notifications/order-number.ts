import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * An order's number as the shop reads it ("1042"), for an alert's words:
 * an alert never shows the order's id. Null when it cannot be read (no
 * such order, or the read failed); the alert is sent all the same.
 */
export async function orderNumberOf(
  container: Pick<MedusaContainer, "resolve">,
  orderId: string | null | undefined
): Promise<string | null> {
  if (!orderId) {
    return null
  }
  try {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["display_id"],
      filters: { id: orderId },
    })
    const number = (data[0] as { display_id?: number | string | null } | undefined)?.display_id
    return number === null || number === undefined ? null : String(number)
  } catch {
    return null
  }
}

/** "#1042", or "—" for an order whose number could not be read. */
export const orderRefText = (number: string | null) => (number ? `#${number}` : "—")
