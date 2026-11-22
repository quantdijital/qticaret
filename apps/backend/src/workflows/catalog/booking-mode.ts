import type { MedusaContainer } from "@medusajs/framework/types"
import { ValidationError } from "../../lib/errors"
import type { PRODUCT_BOOKING_MODES } from "../../modules/catalog-extension/models/product-extension"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { CATALOG_BOOKING, NON_PHYSICAL_PRODUCTS } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import type { ProductKind } from "./shipping-kind"

export type BookingMode = (typeof PRODUCT_BOOKING_MODES)[number]

/** A product's variants as far as stock tracking goes. */
export interface StockVariant {
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
}

/**
 * A catalog save's booking mode (adr/0076 §2). Setting one other than
 * `none` needs `catalog.booking` and `catalog.non_physical` (a product
 * that already has it may stay so with the flags off, as a kind may);
 * `range` is reserved and refused (§11). A dated product is a service:
 * the mode needs the kind the save leaves, and moving a dated product to
 * another kind is refused unless the same save sets the mode back to
 * `none` (its departures and bookings are not dropped unasked). Clearing
 * never needs a flag. The mode the save writes, or undefined to keep it.
 */
export async function bookingModeOf(
  container: MedusaContainer,
  asked: BookingMode | undefined,
  current: BookingMode,
  kind: ProductKind
): Promise<BookingMode | undefined> {
  const mode = asked ?? current
  if (mode === "none") {
    return asked
  }
  if (mode === "range") {
    throw new ValidationError("catalog.booking_range_unavailable", { field: "booking_mode" })
  }
  // A feature turned off answers first, whatever else the save says (K11)
  if (mode !== current) {
    const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const [booking, nonPhysical] = await Promise.all([
      settings.isFeatureEnabled(CATALOG_BOOKING),
      settings.isFeatureEnabled(NON_PHYSICAL_PRODUCTS),
    ])
    if (!booking || !nonPhysical) {
      throw new ValidationError("catalog.booking_disabled", { field: "booking_mode" })
    }
  }
  if (kind !== "service") {
    throw new ValidationError("catalog.booking_kind", { field: asked ? "booking_mode" : "kind" })
  }
  return asked
}

/**
 * Whether a dated product's variants still track stock or sell past it:
 * its places are the booking module's (K2), so the save turns both off.
 */
export const bookingVariantsToAlign = (
  mode: BookingMode,
  variants: readonly (StockVariant | null)[]
): boolean =>
  mode === "departure" &&
  variants.some(
    (variant) => variant?.manage_inventory === true || variant?.allow_backorder === true
  )
