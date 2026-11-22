import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { PACKAGE_TRAVEL_REFUND_DAYS, daysBefore, feeRuleFor } from "../../lib/booking/cancellation"
import type { FeeRule } from "../../lib/booking/cancellation"
import { bookingMarkOf } from "../../lib/booking/cart-lines"
import { CancellationTiers } from "../../lib/booking/settings"
import { ValidationError } from "../../lib/errors"
import { kurus } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { planRefund } from "../../lib/orders"
import type { RefundRequest } from "../../lib/orders"
import { isOfflineProvider } from "../../lib/payments/checkout"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import type { LiveUse } from "../../modules/booking/service"
import { ORDER_REFUNDS_MODULE } from "../../modules/order-refunds"
import type OrderRefundsModuleService from "../../modules/order-refunds/service"
import { readOrderMoney } from "../orders/order-money"
import { returnPolicy } from "../returns/policy"

/**
 * What cancelling one departure of an order gives back (adr/0076 §8, Ek
 * D7a), worked out on the server from the product's tiers, the days left
 * and what the departure's lines were paid; read only. The shopper's
 * preview, their cancel, staff's and the shop's departure cancel all read
 * this. Amounts in kuruş.
 */

/** Who cancels: the shopper (their tier), staff (the tier or all of it), the shop's departure cancel (all). */
export type CancelMode = "tier" | "full"

interface OrderRow {
  id: string
  status?: string | null
  customer_id?: string | null
  currency_code?: string | null
  items?: ({ id: string; quantity?: unknown; metadata?: unknown } | null)[] | null
  payment_collections?:
    | ({
        payments?: ({ provider_id?: string | null; captured_at?: unknown } | null)[] | null
      } | null)[]
    | null
}

export interface CancelPlan {
  order_id: string
  customer_id: string | null
  order_status: string
  use: LiveUse
  /** The use row's id: the refund's reference is made from it. */
  use_id: string
  starts_at: Date
  timezone: string
  days_before: number
  /** The rule applied; null: the shop set no tier (only a full refund can be chosen). */
  rule: FeeRule | null
  /** What the departure's lines still hold of what was paid. */
  paid: Kurus
  /** What goes back now. */
  refund: Kurus
  /** The refund's request: the departure's lines, their units left and the share kept. */
  request: RefundRequest | null
  /** Money taken by hand (a bank transfer, an edit's difference): it goes back by hand. */
  taken_by_hand: boolean
  /** Nothing was taken yet (a bank transfer not confirmed). */
  unpaid: boolean
  /** The refund comes within this many days (package travel), or null. */
  refund_within_days: number | null
  currency_code: string
}

const ORDER_FIELDS = [
  "id",
  "status",
  "customer_id",
  "currency_code",
  "items.id",
  "items.quantity",
  "items.metadata",
  "payment_collections.payments.provider_id",
  "payment_collections.payments.captured_at",
]

const service = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<BookingModuleService>(BOOKING_MODULE)

async function orderOf(container: MedusaContainer, orderId: string): Promise<OrderRow> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ORDER_FIELDS,
    filters: { id: orderId },
  })
  const order = (data as OrderRow[])[0]
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
  }
  return order
}

/** The departure and its product's settings. */
async function slotFacts(container: MedusaContainer, slotId: string) {
  const bookings = service(container)
  const [slot] = await bookings.listBookingSlots({ id: slotId }, { take: 1 })
  if (!slot) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "booking.slot_unknown")
  }
  const [bookable] = await bookings.listBookables({ id: slot.bookable_id }, { take: 1 })
  const tiers = CancellationTiers.safeParse(bookable?.cancellation_tiers ?? [])
  return {
    starts_at: new Date(slot.starts_at),
    timezone: bookable?.timezone ?? "Europe/Istanbul",
    tiers: tiers.success ? tiers.data : [],
  }
}

/** The use row behind a live departure (its id names the refund). */
async function useIdOf(container: MedusaContainer, use: LiveUse): Promise<string> {
  const [row] = await service(container).listBookingSlotUses(
    { booking_id: use.booking_id, slot_id: use.slot_id },
    { take: 1, select: ["id"] }
  )
  return row?.id ?? ""
}

/** The order's live departure on the slot, or null (none, or cancelled already). */
export async function liveUseOf(
  container: MedusaContainer,
  orderId: string,
  slotId: string
): Promise<LiveUse | null> {
  const uses = await service(container).liveUsesOfOrder(orderId)
  return uses.find((use) => use.slot_id === slotId) ?? null
}

/** The departure's refund under a rule: its lines' units left, less the share kept. */
async function refundOf(
  container: MedusaContainer,
  order: OrderRow,
  slotId: string,
  feePercent: number
): Promise<{ paid: Kurus; refund: Kurus; request: RefundRequest | null }> {
  const money = await readOrderMoney(container, order.id)
  const refunded = await container
    .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    .refundedLines(order.id)
  const items = (order.items ?? []).flatMap((item) => {
    if (!item || bookingMarkOf(item.metadata)?.slot_id !== slotId) {
      return []
    }
    const left = Number(item.quantity ?? 0) - (refunded.units.get(item.id) ?? 0)
    return left > 0 ? [{ id: item.id, quantity: left }] : []
  })
  if (items.length === 0 || money.refundable <= 0) {
    return { paid: kurus(0), refund: kurus(0), request: null }
  }
  const plan = (fee: number) => {
    try {
      return planRefund(money.lines, refunded, { items, fee_percent: fee }, money.refundable).total
    } catch (error) {
      // Everything kept, or nothing left to give: no refund
      if ((error as { safeMessage?: string }).safeMessage === "orders.refund_empty") {
        return kurus(0)
      }
      throw error
    }
  }
  const refund = plan(feePercent)
  return {
    paid: plan(0),
    refund,
    request: refund > 0 ? { items, fee_percent: feePercent } : null,
  }
}

/**
 * The plan for cancelling the order's departure on `slotId` now. Null
 * when the order has no live departure there (none, or cancelled
 * already). `mode: "full"` gives everything back (staff's choice, the
 * shop's departure cancel); `tier` the product's tier, and with no tier
 * set nothing is planned to go back (`rule` null: the caller refuses).
 */
export async function planBookingCancel(
  container: MedusaContainer,
  input: { order_id: string; slot_id: string; mode: CancelMode; now?: Date }
): Promise<CancelPlan | null> {
  const use = await liveUseOf(container, input.order_id, input.slot_id)
  if (!use) {
    return null
  }
  const [order, slot, policy] = await Promise.all([
    orderOf(container, input.order_id),
    slotFacts(container, input.slot_id),
    returnPolicy(container),
  ])
  const now = input.now ?? new Date()
  const days = daysBefore(slot.starts_at, now, slot.timezone)
  const packageTravel = policy.package_travel
  const rule: FeeRule | null =
    input.mode === "full"
      ? { fee_percent: 0, days_before: null }
      : feeRuleFor(slot.tiers, days, { packageTravel })
  const money = await refundOf(container, order, input.slot_id, rule?.fee_percent ?? 100)
  const taken = (order.payment_collections ?? []).flatMap((collection) =>
    (collection?.payments ?? []).filter((payment) => Boolean(payment?.captured_at))
  )
  return {
    order_id: order.id,
    customer_id: order.customer_id ?? null,
    order_status: order.status ?? "",
    use,
    use_id: await useIdOf(container, use),
    starts_at: slot.starts_at,
    timezone: slot.timezone,
    days_before: days,
    rule,
    paid: money.paid,
    refund: rule ? money.refund : kurus(0),
    request: rule ? money.request : null,
    taken_by_hand:
      taken.length > 1 || taken.some((payment) => isOfflineProvider(payment?.provider_id ?? "")),
    unpaid: taken.length === 0,
    refund_within_days: packageTravel ? PACKAGE_TRAVEL_REFUND_DAYS : null,
    currency_code: order.currency_code ?? "try",
  }
}

/**
 * Why the shopper may not cancel the departure themselves (an i18n key),
 * null when they may: the order cancelled, the day reached, no tier set,
 * money taken by hand (the shop gives it back) or none taken yet (the
 * whole order's cancel is theirs then).
 */
export function customerCancelRefusal(plan: CancelPlan, now = new Date()): string | null {
  if (plan.order_status === "canceled") {
    return "orders.canceled"
  }
  if (plan.starts_at.getTime() <= now.getTime()) {
    return "booking.cancel_too_late"
  }
  if (!plan.rule) {
    return "booking.cancel_unavailable"
  }
  if (plan.unpaid) {
    return "booking.cancel_unpaid"
  }
  return plan.taken_by_hand ? "orders.cancel_contact_shop" : null
}

/** A plan's refusal as the error the routes answer with. */
export function refuse(reason: string): never {
  throw new ValidationError(reason)
}
