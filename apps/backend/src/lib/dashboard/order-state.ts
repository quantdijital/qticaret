import { isCarrierProvider } from "../shipping/carriers"
import { lifecycleOf, shippableItems } from "./lifecycle"
import type { Lifecycle, LifecycleItem, LifecycleOrder } from "./lifecycle"

/**
 * What can be done with one order next, worked out on the server so the
 * panel and the actions agree (adr/0022): ship what is left (a packed
 * parcel first), mark parcels on their way delivered, take held payments,
 * cancel while nothing has left. A parcel packed with a carrier's label
 * (adr/0031) is not handed over here: it waits for the carrier's pickup.
 * Pure, so tested on its own.
 */

type When = string | Date | null | undefined

export const ORDER_STATE_FIELDS = [
  "id",
  "items.id",
  "fulfillments.id",
  "fulfillments.provider_id",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "fulfillments.canceled_at",
  "fulfillments.items.line_item_id",
  "fulfillments.items.quantity",
  "payment_collections.payments.id",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
]

export interface StateOrder extends LifecycleOrder {
  id: string
  items?: ((LifecycleItem & { id: string }) | null)[] | null
  fulfillments?:
    | ({
        id: string
        provider_id?: string | null
        shipped_at?: When
        delivered_at?: When
        canceled_at?: When
        items?: ({ line_item_id?: string | null; quantity?: number | null } | null)[] | null
      } | null)[]
    | null
  payment_collections?:
    | (
        | (NonNullable<NonNullable<LifecycleOrder["payment_collections"]>[number]> & {
            payments?: ({ id: string; captured_at?: When; canceled_at?: When } | null)[] | null
          })
        | null
      )[]
    | null
}

export interface ShipmentPlan {
  /** A parcel already packed is handed over first; null: a new one is packed. */
  fulfillment_id: string | null
  items: { id: string; quantity: number }[]
  /**
   * Beside a packed parcel, the lines not in any parcel yet: they may go
   * in a parcel of their own, before or after it (adr/0054, 2026-11-05
   * addendum). Empty when nothing is packed (`items` is what is left).
   */
  rest: { id: string; quantity: number }[]
}

export interface OrderState {
  stage: Lifecycle
  ship: ShipmentPlan | null
  /** Parcels packed with a carrier's label, waiting for the carrier to pick them up. */
  pickup: string[]
  /** Parcels handed over and not yet delivered. */
  deliver: string[]
  /** Payments held and not yet taken. */
  capture: string[]
  cancelable: boolean
}

const present = <T>(rows: (T | null)[] | null | undefined): T[] =>
  (rows ?? []).filter((row): row is T => row !== null)

function shipmentPlan(order: StateOrder): ShipmentPlan | null {
  const active = present(order.fulfillments).filter((row) => !row.canceled_at)
  const packed = active.find((row) => !row.shipped_at && !isCarrierProvider(row.provider_id))
  // Only lines that travel in a parcel: Medusa refuses a fulfillment mixing both kinds
  const left = shippableItems(order.items).flatMap((item) => {
    const quantity = (item.quantity ?? 0) - (item.detail?.fulfilled_quantity ?? 0)
    return quantity > 0 ? [{ id: item.id, quantity }] : []
  })
  if (packed) {
    const items = present(packed.items).flatMap((item) =>
      item.line_item_id && (item.quantity ?? 0) > 0
        ? [{ id: item.line_item_id, quantity: item.quantity ?? 0 }]
        : []
    )
    return { fulfillment_id: packed.id, items, rest: left }
  }
  return left.length > 0 ? { fulfillment_id: null, items: left, rest: [] } : null
}

export function orderState(order: StateOrder): OrderState {
  const stage = lifecycleOf(order)
  if (stage === "canceled") {
    return { stage, ship: null, pickup: [], deliver: [], capture: [], cancelable: false }
  }
  const active = present(order.fulfillments).filter((row) => !row.canceled_at)
  const payments = present(order.payment_collections).flatMap((row) => present(row.payments))
  return {
    stage,
    ship: shipmentPlan(order),
    pickup: active
      .filter((row) => !row.shipped_at && isCarrierProvider(row.provider_id))
      .map((row) => row.id),
    deliver: active.filter((row) => row.shipped_at && !row.delivered_at).map((row) => row.id),
    capture: payments.filter((row) => !row.captured_at && !row.canceled_at).map((row) => row.id),
    // Medusa cancels an order only with its parcels canceled first; the panel offers it before any
    cancelable: active.length === 0,
  }
}
