import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"

/** A bookable's row as the module keeps it. */
export interface BookableRow {
  id: string
  product_id: string
  mode: string
  cutoff_hours: number
  hold_minutes: number
  max_units_per_cart: number
  min_participants: number | null
  traveler_fields: unknown
  cancellation_tiers: unknown
  pax_by_variant: unknown
  timezone: string
  reminder_days: number
}

/** A dated product: its variants and its booking settings, if made yet. */
export interface DatedProduct {
  id: string
  variantIds: string[]
  bookable: BookableRow | null
}

interface ProductRow {
  id: string
  variants?: ({ id: string } | null)[] | null
  product_extension?: { booking_mode?: string | null } | null
  bookable?: BookableRow | null
}

/**
 * The product, refused unless it is sold by departure (adr/0076 §2): its
 * booking settings and slots are only for a dated product.
 */
export async function datedProduct(
  container: MedusaContainer,
  productId: string
): Promise<DatedProduct> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "variants.id", "product_extension.booking_mode", "bookable.*"],
    filters: { id: productId },
  })
  const product = data[0] as ProductRow | undefined
  if (!product) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.product_unknown")
  }
  if (product.product_extension?.booking_mode !== "departure") {
    throw new ValidationError("booking.product_not_dated", { field: "booking_mode" })
  }
  return {
    id: product.id,
    variantIds: (product.variants ?? []).flatMap((variant) => (variant ? [variant.id] : [])),
    bookable: product.bookable ?? null,
  }
}

/** Refuses variant ids that are not the product's (a price difference, a place count). */
export function checkVariants(product: DatedProduct, ids: readonly string[], field: string): void {
  const known = new Set(product.variantIds)
  if (ids.some((id) => !known.has(id))) {
    throw new ValidationError("booking.variant_unknown", { field })
  }
}
