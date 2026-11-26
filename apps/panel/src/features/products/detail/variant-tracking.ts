import type { TrackingChange } from "@/features/products/api/stock-tracking"
import type { Dirty, Variant, VariantValues } from "./variant-values"

/**
 * Stock tracking as changed: turned on, with the typed count (the server
 * makes its item and level); turned off. Undefined when it stays as it is.
 */
export function trackingEdit(
  variant: Variant,
  values: VariantValues,
  dirty: Dirty,
  locationId: string | null
): TrackingChange | undefined {
  const was = Boolean(variant.manage_inventory)
  if (!dirty?.tracked || values.tracked === was) {
    return undefined
  }
  return values.tracked
    ? { tracked: true, ...(locationId ? { quantity: Number(values.stock) } : {}) }
    : { tracked: false }
}
