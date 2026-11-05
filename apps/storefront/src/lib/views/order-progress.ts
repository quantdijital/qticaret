import type { OrderStepKey, OrderStepView, Translate } from "@qticaret/ui"
import type { ShipmentRow, StoreOrder } from "@/lib/orders/order"

/**
 * Where an order stands, step by step (adr/0046 Ek 2026-11-05), from what
 * the backend says of it: its payment and fulfilment status and the
 * parcels that left. Pure, so the order page and its tests read it alike.
 */

const PAID = new Set([
  "authorized",
  "partially_authorized",
  "captured",
  "partially_captured",
  "partially_refunded",
  "refunded",
])
const PACKED = new Set([
  "fulfilled",
  "partially_fulfilled",
  "shipped",
  "partially_shipped",
  "delivered",
  "partially_delivered",
])
const SHIPPED = new Set(["shipped", "partially_shipped", "delivered", "partially_delivered"])

type Order = Pick<StoreOrder, "status" | "payment_status" | "fulfillment_status" | "created_at">
type Parcel = Pick<ShipmentRow, "shipped_at" | "delivered_at">

const times = (values: (string | null)[]) =>
  values.flatMap((value) => (value ? [new Date(value).getTime()] : [])).filter(Number.isFinite)

/**
 * The steps: placed, paid (none for cash on delivery, paid at the door),
 * packed, shipped, delivered. The first one not done is current; a
 * transfer not paid yet says it waits. Null for a cancelled order.
 */
export function orderProgress(
  order: Order,
  parcels: readonly Parcel[],
  { cashOnDelivery }: { cashOnDelivery: boolean },
  t: Translate,
  when: (date: Date) => string
): OrderStepView[] | null {
  if (order.status === "canceled") {
    return null
  }
  const shipped = times(parcels.map((parcel) => parcel.shipped_at))
  const delivered = times(parcels.map((parcel) => parcel.delivered_at))
  const allDelivered = parcels.length > 0 && delivered.length === parcels.length
  const at = (value: number | undefined) => (value === undefined ? null : when(new Date(value)))
  const steps: { key: OrderStepKey; done: boolean; at: string | null }[] = [
    { key: "placed", done: true, at: when(new Date(order.created_at)) },
    ...(cashOnDelivery
      ? []
      : [{ key: "paid" as const, done: PAID.has(order.payment_status), at: null }]),
    {
      key: "packed",
      done: PACKED.has(order.fulfillment_status) || parcels.length > 0,
      at: null,
    },
    {
      key: "shipped",
      done: SHIPPED.has(order.fulfillment_status) || shipped.length > 0,
      at: at(shipped.length > 0 ? Math.min(...shipped) : undefined),
    },
    {
      key: "delivered",
      done: order.fulfillment_status === "delivered" || allDelivered,
      at: at(allDelivered ? Math.max(...delivered) : undefined),
    },
  ]
  // A later step done means the ones before it are too (a parcel delivered was packed and sent)
  const last = steps.map((step) => step.done).lastIndexOf(true)
  const current = steps.findIndex((step, index) => !step.done && index > last)
  return steps.map((step, index) => {
    const done = index <= last
    const state = done ? "done" : index === current ? "current" : "ahead"
    const waiting = step.key === "paid" && state === "current"
    return {
      key: step.key,
      label: t(waiting ? "order.step_paid_waiting" : `order.step_${step.key}`),
      state,
      at: done ? step.at : null,
    }
  })
}

/** How the order is paid, in words, from its payment sessions' providers; null when none is known. */
export function paymentWordsOf(providers: readonly string[], t: Translate): string | null {
  if (providers.includes("pp_cod_cod")) {
    return t("checkout.pay_cod")
  }
  if (providers.some((id) => id.includes("bank-transfer"))) {
    return t("checkout.pay_bank")
  }
  if (providers.some((id) => id.includes("paytr") || id.includes("iyzico"))) {
    return t("checkout.pay_card")
  }
  if (providers.includes("credit")) {
    return t("cart.gift_card_label")
  }
  return null
}
