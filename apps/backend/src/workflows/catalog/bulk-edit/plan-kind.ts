import type { BulkChange } from "./change"
import { UNCHANGED, skipped, writing } from "./plan-result"
import type { BulkDiff, BulkPlan, PlanContext } from "./plan-result"
import type { BulkProduct } from "./products"

/**
 * A product's kind (F3.2) and booking mode (adr/0076 §2) for one product,
 * by the product page's own rules (`kind-rules.ts`, `booking-mode.ts`),
 * planned from what it has just before it is written. Pure: the flags are
 * read once for the run, and the catalog save checks them again as it writes.
 *
 * - A gift card is digital: another kind leaves it as it is.
 * - Digital and service need `catalog.non_physical`; a product already of
 *   that kind may stay so with the flag off.
 * - Dated sale needs `catalog.booking` and `catalog.non_physical`, unless
 *   the product is dated already.
 * - A dated product leaving dated sale (another kind, or service booked by
 *   none) is changed: the save sets the mode back to none in the same run,
 *   as the product page does once its warning is confirmed. Its departures
 *   and bookings are kept.
 */
export function planKind(
  product: BulkProduct,
  change: Extract<BulkChange, { action: "kind" }>,
  context: PlanContext
): BulkPlan {
  const extension = product.product_extension
  const kind = extension?.kind ?? "physical"
  const mode = extension?.booking_mode ?? "none"
  const giftCard = extension?.is_gift_card === true
  if (giftCard && change.kind !== "digital") {
    return skipped("catalog.gift_card_kind")
  }
  if (change.kind === kind && change.booking_mode === mode) {
    return UNCHANGED
  }
  const features = context.features ?? { nonPhysical: false, booking: false }
  if (change.kind !== "physical" && change.kind !== kind && !giftCard && !features.nonPhysical) {
    return skipped("catalog.kind_disabled")
  }
  if (
    change.booking_mode !== "none" &&
    change.booking_mode !== mode &&
    !(features.booking && features.nonPhysical)
  ) {
    return skipped("catalog.booking_disabled")
  }
  const diff: BulkDiff = {
    ...(change.kind === kind ? {} : { kind: { before: kind, after: change.kind } }),
    ...(change.booking_mode === mode
      ? {}
      : { booking_mode: { before: mode, after: change.booking_mode } }),
  }
  return writing({ action: "kind", kind: change.kind, booking_mode: change.booking_mode }, diff)
}

/** Whether a plan takes a dated product off dated sale (the preview's warning). */
export function endsBooking(plan: BulkPlan): boolean {
  if (plan.kind !== "write" || plan.write.action !== "kind") {
    return false
  }
  const mode = plan.diff["booking_mode"]
  return mode !== undefined && mode.before !== "none" && mode.after === "none"
}
