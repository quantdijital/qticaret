import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import type { BookingSlot, SlotStatus } from "@/features/products/api/booking"

/** Places sold or held on departures still ahead (a cancelled one holds none). */
export function takenAhead(slots: readonly BookingSlot[], now: Date = new Date()): number {
  return slots
    .filter((slot) => slot.status !== "cancelled" && new Date(slot.starts_at) > now)
    .reduce((sum, slot) => sum + slot.sold + slot.held, 0)
}

/** A departure's state as a badge's tone. */
export const SLOT_TONES: Readonly<Record<SlotStatus, StatusTone>> = {
  open: "success",
  closed: "neutral",
  cancelled: "danger",
}

/** A variant (a price category, adr/0076 §4) by its name in the panel. */
export interface VariantName {
  id: string
  title: string
}

/** The product's variants by name: the title, else the SKU, else the id. */
export const variantNamesOf = (
  variants: readonly { id: string; title: string | null; sku: string | null }[]
): VariantName[] =>
  variants.map((variant) => ({ id: variant.id, title: variant.title ?? variant.sku ?? variant.id }))

/** The lowest capacity a departure takes: what is sold and held on it. */
export const minCapacityOf = (slot: BookingSlot): number => slot.sold + slot.held
