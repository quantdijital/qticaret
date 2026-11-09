import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  fakeInvoicingAllowed,
  saleInvoiceHold,
  testPaymentProvider,
  testPaymentsInvoiced,
} from "../../lib/invoicing"
import type { InvoiceHold, InvoiceMoment, InvoiceOrderRow } from "../../lib/invoicing"
import { HOLD_FIELDS, invoicingOf } from "./queue-invoices"

type Container = Pick<MedusaContainer, "resolve">

type Parcel = {
  shipped_at?: string | Date | null
  delivered_at?: string | Date | null
  canceled_at?: string | Date | null
} | null

/** Why an order has no sale invoice, for the shop; the payment's provider when a test one held it. */
export interface SaleHold {
  reason: InvoiceHold
  /** The provider whose test mode took the payment (`pp_paytr_paytr`), for `test_payment`. */
  payment_provider: string | null
}

/**
 * Every moment the order has reached: placed and its payment (whether
 * taken is the rule's to read), its parcel gone, its parcel delivered.
 */
function reached(parcels: Parcel[]): InvoiceMoment[] {
  const live = parcels.filter((parcel) => parcel && !parcel.canceled_at)
  return [
    "placed",
    "paid",
    ...(live.some((parcel) => parcel?.shipped_at) ? (["shipped"] as const) : []),
    ...(live.some((parcel) => parcel?.delivered_at) ? (["delivered"] as const) : []),
  ]
}

/**
 * Why the order's sale invoice is not queued, by the queue's own rule
 * (`saleInvoiceHold`) over every moment it has reached; null when nothing
 * holds it (it is queued, or was sold before invoicing was turned on).
 */
export async function orderSaleHold(
  container: Container,
  orderId: string
): Promise<SaleHold | null> {
  const settings = await invoicingOf(container)
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      ...HOLD_FIELDS,
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
      "fulfillments.canceled_at",
    ],
    filters: { id: orderId },
  })
  const order = data[0] as (InvoiceOrderRow & { fulfillments?: Parcel[] | null }) | undefined
  if (!order) {
    return null
  }
  const reason = saleInvoiceHold({
    settings,
    order,
    moments: reached(order.fulfillments ?? []),
    fakeAllowed: fakeInvoicingAllowed(),
    testPaymentsInvoiced: testPaymentsInvoiced(settings.provider),
  })
  return reason
    ? {
        reason,
        payment_provider: reason === "test_payment" ? testPaymentProvider(order) : null,
      }
    : null
}
