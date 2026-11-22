import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { bookingMarkOf } from "../../../lib/booking/cart-lines"
import { ValidationError } from "../../../lib/errors"

type Container = Pick<MedusaContainer, "resolve">

interface ItemInput {
  variant_id?: string | null | undefined
  metadata?: unknown
}

interface VariantRow {
  id: string
  product?: { product_extension?: { booking_mode?: string | null } | null } | null
}

/**
 * A dated product's variant goes into a cart only through its booking
 * route (adr/0076 §5, K6): an ordinary line would take no place and carry
 * no departure. A line the route adds carries its booking mark (`qt_`
 * metadata, which no storefront may write) and passes.
 */
export async function refusePlainDatedItems(
  container: Container,
  items: readonly ItemInput[] | null | undefined
): Promise<void> {
  const variantIds = [
    ...new Set(
      (items ?? []).flatMap((item) =>
        item.variant_id && !bookingMarkOf(item.metadata) ? [item.variant_id] : []
      )
    ),
  ]
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
    throw new ValidationError("booking.use_booking_route", { field: "variant_id" })
  }
}
