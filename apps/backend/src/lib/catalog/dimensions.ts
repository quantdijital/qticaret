/**
 * Weight and dimensions a physical product needs before it is published
 * (F3.1; carriers price by them, F7.2), each above zero. They are in the
 * units of the store settings (`weight_unit`, `dimension_unit`; g and cm
 * by default); F7.2 converts. A variant without its own value takes the
 * product's.
 */

export const DIMENSION_FIELDS = ["weight", "length", "width", "height"] as const

export type DimensionField = (typeof DIMENSION_FIELDS)[number]
export type Dimensions = Partial<Record<DimensionField, number | null>>

/** The fields `variant` has no usable value for, its own or the product's. */
export function missingDimensions(product: Dimensions, variant: Dimensions = {}): DimensionField[] {
  return DIMENSION_FIELDS.filter((field) => {
    const value = variant[field] ?? product[field]
    return typeof value !== "number" || !Number.isFinite(value) || value <= 0
  })
}
