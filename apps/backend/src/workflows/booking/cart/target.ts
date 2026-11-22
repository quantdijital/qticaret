import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  adjustmentOf,
  adjustmentProblem,
  bookingUnitPrice,
  salesClosed,
} from "../../../lib/booking/cart-lines"
import { ConflictError, ValidationError } from "../../../lib/errors"
import type { Kurus } from "../../../lib/money"
import { BOOKING_MODULE } from "../../../modules/booking"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { CATALOG_BOOKING } from "../../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import type BookingModuleService from "../../../modules/booking/service"
import type { SlotAvailability } from "../../../modules/booking/service"
import { variantPrice } from "../../addons/cart"
import type { AddonCart } from "../../addons/cart"
import type { BookableRow } from "../product"

type Container = Pick<MedusaContainer, "resolve">

/** A departure as a cart books it: the slot, its product's settings, the product itself. */
export interface BookingTarget {
  slot: SlotAvailability
  bookable: BookableRow
  product: { id: string; variantIds: string[] }
}

interface ProductRow {
  id: string
  status?: string | null
  variants?: ({ id: string } | null)[] | null
  sales_channels?: ({ id: string } | null)[] | null
  product_extension?: { booking_mode?: string | null } | null
}

export const bookingService = (container: Container) =>
  container.resolve<BookingModuleService>(BOOKING_MODULE)

export const bookingEnabled = (container: Container) =>
  container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .isFeatureEnabled(CATALOG_BOOKING)

/**
 * The departure, its settings and its product, as this storefront sees
 * them: a slot of a product that is not published, not dated or not in
 * the cart's channel reads as unknown (a shopper learns nothing of it).
 */
export async function readBookingTarget(
  container: Container,
  slotId: string,
  salesChannelId: string | null | undefined
): Promise<BookingTarget> {
  const service = bookingService(container)
  const [slot] = await service.slotAvailability([slotId])
  const [bookable] = slot
    ? ((await service.listBookables({ id: slot.bookable_id })) as unknown as BookableRow[])
    : []
  if (!slot || !bookable) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "booking.slot_unknown")
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "status", "variants.id", "sales_channels.id", "product_extension.booking_mode"],
    filters: { id: bookable.product_id },
  })
  const product = data[0] as ProductRow | undefined
  const listed = (product?.sales_channels ?? []).some(
    (channel) => channel?.id && channel.id === salesChannelId
  )
  if (
    product?.status !== "published" ||
    product.product_extension?.booking_mode !== "departure" ||
    !listed
  ) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "booking.slot_unknown")
  }
  return {
    slot,
    bookable,
    product: {
      id: product.id,
      variantIds: (product.variants ?? []).flatMap((variant) => (variant ? [variant.id] : [])),
    },
  }
}

/** Refused unless the departure still sells: open, and its sales not closed yet. */
export function assertSlotSells(target: BookingTarget, now: Date = new Date()): void {
  if (target.slot.status !== "open") {
    throw new ConflictError("booking.slot_closed")
  }
  if (salesClosed(target.slot.starts_at, target.bookable.cutoff_hours, now)) {
    throw new ConflictError("booking.sales_closed")
  }
}

/** Refused unless every variant is the departure's product's (a price category of it). */
export function assertVariantsOf(target: BookingTarget, variantIds: readonly string[]): void {
  const known = new Set(target.product.variantIds)
  if (variantIds.some((id) => !known.has(id))) {
    throw new ValidationError("booking.variant_unknown", { field: "variant_id" })
  }
}

export interface BookingPrice {
  unit_price: Kurus
  /** The price before a sale list, with the departure's difference; null without a sale. */
  compare_at_unit_price: Kurus | null
  /**
   * Whether the price has the tax in, as the variant's own price does: the
   * line says so, or a tax-inclusive shop would add the tax on top.
   */
  is_tax_inclusive: boolean
}

/**
 * A dated line's price now (adr/0076 §4): the variant's price in the
 * cart's own pricing context (currency, region, customer group price
 * lists, quantity tiers), as an ordinary line gets it, plus the
 * departure's difference; never below zero. Nothing comes from the shopper.
 */
export async function priceBookingLine(
  container: Container,
  cart: AddonCart,
  target: BookingTarget,
  variantId: string,
  quantity: number
): Promise<BookingPrice> {
  const adjustment = adjustmentOf(target.slot.price_adjustments, variantId)
  const problem = adjustmentProblem(cart.currency_code, adjustment)
  if (problem) {
    throw new ValidationError(problem, { field: "currency_code" })
  }
  const base = await variantPrice(container, cart, variantId, quantity)
  if (!base) {
    throw new ValidationError("booking.price_unavailable", { field: "variant_id" })
  }
  return {
    unit_price: bookingUnitPrice(base.calculated, adjustment),
    compare_at_unit_price:
      base.original === null ? null : bookingUnitPrice(base.original, adjustment),
    is_tax_inclusive: base.tax_inclusive,
  }
}
