import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { bookingMarkOf } from "../../lib/booking/cart-lines"
import { ValidationError } from "../../lib/errors"

type Container = Pick<MedusaContainer, "resolve">

interface VariantRow {
  id: string
  product?: { product_extension?: { booking_mode?: string | null } | null } | null
}

/**
 * An order edit leaves a departure's places alone (adr/0076 Ek, until
 * D7): a dated line is not added to, lowered or taken off (its places
 * and its booking would not follow), and a dated product's variant is
 * not added (it would take no place). The whole order's cancel gives
 * the places back; returns, exchanges and claims come with D7.
 */
export async function refuseBookingEdits(
  container: Container,
  orderLines: readonly ({ id: string; metadata?: unknown } | null)[],
  changes: { items: readonly { id: string }[]; add: readonly { variant_id: string }[] }
): Promise<void> {
  const dated = new Set(
    orderLines.flatMap((line) => (line && bookingMarkOf(line.metadata) ? [line.id] : []))
  )
  if (changes.items.some((item) => dated.has(item.id))) {
    throw new ValidationError("booking.order_edit_unavailable", { field: "items" })
  }
  const variantIds = [...new Set(changes.add.map((item) => item.variant_id))]
  if (variantIds.length === 0) {
    return
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: ["id", "product.product_extension.booking_mode"],
    filters: { id: variantIds },
  })
  if (
    (data as VariantRow[]).some(
      (variant) => variant.product?.product_extension?.booking_mode === "departure"
    )
  ) {
    throw new ValidationError("booking.order_edit_unavailable", { field: "add" })
  }
}
