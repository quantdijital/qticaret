import { MathBN } from "@medusajs/framework/utils"
import type { InvoicingSettings } from "../../modules/platform-settings/sections"
import type { InvoicingProvider } from "../../modules/platform-settings/sections/invoicing"
import type { MedusaAmount } from "../money"
import { COD_PAYMENT_PROVIDER_ID } from "../payments/checkout"
import { paidInTestMode } from "../payments/test-mode"

/**
 * What made an order due: placed, its payment taken (a transfer confirmed,
 * cash collected at the door), its parcel gone, or its parcel delivered.
 */
export type InvoiceMoment = "placed" | "paid" | "shipped" | "delivered"

export interface OrderRow {
  status?: string | null
  canceled_at?: string | Date | null
  currency_code?: string | null
  payment_collections?:
    | ({
        payments?:
          | ({
              provider_id?: string | null
              captured_at?: string | Date | null
              data?: unknown
            } | null)[]
          | null
      } | null)[]
    | null
  /** Medusa's, the gift cards and store credit that paid it taken off. */
  total?: MedusaAmount | null
  version?: number | null
  credit_lines?: ({ raw_amount?: MedusaAmount | null; version?: number | null } | null)[] | null
}

const paymentsOf = (order: OrderRow) =>
  (order.payment_collections ?? []).flatMap((collection) => collection?.payments ?? [])

/**
 * Gift cards or store credit paid all of it (adr/0025): no payment was
 * taken, nothing is left to pay, and it is as paid as it will be.
 */
const coveredByCredit = (order: OrderRow): boolean =>
  (order.credit_lines ?? []).some(
    (line) =>
      line !== null &&
      (order.version === undefined || line.version === order.version) &&
      MathBN.gt(line.raw_amount ?? 0, 0)
  ) &&
  order.total !== undefined &&
  order.total !== null &&
  MathBN.lte(order.total, 0)

/**
 * Its money taken: a card's capture, a transfer confirmed, cash collected
 * at the door; or nothing to take, gift cards or store credit having paid it.
 */
export const invoicePaid = (order: OrderRow): boolean =>
  paymentsOf(order).some((payment) => Boolean(payment?.captured_at)) || coveredByCredit(order)

const cashOnDelivery = (order: OrderRow): boolean =>
  paymentsOf(order).some((payment) => payment?.provider_id === COD_PAYMENT_PROVIDER_ID)

/**
 * Whether the moment makes the order due (adr/0034 §8 and its addendum of
 * 2026-10-31, the shop's accountant):
 * - cash on delivery once delivered, or once the cash is recorded as
 *   collected, whatever the shop's setting;
 * - otherwise by the setting: once placed and paid (the default), or when
 *   its parcel leaves (a delivery counts, in case the parcel's event was missed);
 * - with BirFatura managing the parcels, neither: once paid, cash on
 *   delivery once placed (BirFatura must have the order to ship it).
 */
export function invoiceDue(
  order: OrderRow,
  moment: InvoiceMoment,
  settings: Pick<InvoicingSettings, "trigger">,
  birfaturaShips = false
): boolean {
  // BirFatura's cargo module ships only orders it has pulled (adr/0072 Ek
  // 2026-11-26): waiting for the parcel would never let it go. Handed over
  // once paid, cash on delivery once placed; BirFatura's own rules say when
  // it issues the invoice
  if (birfaturaShips) {
    return cashOnDelivery(order) || invoicePaid(order)
  }
  if (cashOnDelivery(order)) {
    return moment === "delivered" || (moment === "paid" && invoicePaid(order))
  }
  const parcel = moment === "shipped" || moment === "delivered"
  if (parcel !== (settings.trigger === "shipped")) {
    return false
  }
  return parcel || invoicePaid(order)
}

/**
 * Why an order's sale invoice is not queued (yet), in the order the shop
 * reads it: invoicing off, the order canceled, paid in a provider's test
 * mode, sold in another currency; or waiting for its payment, its parcel
 * leaving, or (cash on delivery) its delivery.
 */
export const INVOICE_HOLDS = [
  "off",
  "canceled",
  "test_payment",
  "currency",
  "awaiting_payment",
  "awaiting_shipment",
  "awaiting_delivery",
] as const
export type InvoiceHold = (typeof INVOICE_HOLDS)[number]

/** The holds a later moment lifts; the others stay. */
const WAITS: ReadonlySet<InvoiceHold> = new Set([
  "awaiting_payment",
  "awaiting_shipment",
  "awaiting_delivery",
])
export const isWait = (hold: InvoiceHold): boolean => WAITS.has(hold)

/** A program issues the shop's invoices: one picked, and not the fake one outside tests. */
export function invoicingOn<T extends Pick<InvoicingSettings, "provider">>(
  settings: T,
  fakeAllowed: boolean
): settings is T & { provider: Exclude<InvoicingProvider, "none"> } {
  return settings.provider !== "none" && (settings.provider !== "fake" || fakeAllowed)
}

export interface InvoiceFacts {
  settings: Pick<InvoicingSettings, "provider" | "trigger">
  order: OrderRow
  /** The moments asked about: the queue's one, or every moment the order has reached. */
  moments: readonly InvoiceMoment[]
  /** Whether the fake program may run here (`fakeInvoicingAllowed`). */
  fakeAllowed: boolean
  /** Whether a provider's test-mode payment is invoiced here (`testPaymentsInvoiced`, dev only). */
  testPaymentsInvoiced: boolean
  /**
   * A sale of gift cards alone (adr/0025 Ek 2026-11-03): its record is due
   * once paid, whatever the setting; unknown until its lines are read.
   */
  advanceOnly?: boolean
  /**
   * BirFatura's cargo module manages the shop's parcels (`birfaturaShips`,
   * adr/0072 Ek 2026-11-26): the order goes to BirFatura before its parcel
   * leaves, whatever the setting says.
   */
  birfaturaShips?: boolean
}

/**
 * The single rule for whether an order's sale invoice may be queued now
 * (adr/0034 §8): null when it may, else why not. The queue asks it with
 * the moment that came; the order page with every moment the order has
 * reached, to tell the shop why there is no invoice.
 */
export function saleInvoiceHold(facts: InvoiceFacts): InvoiceHold | null {
  const { settings, order } = facts
  if (!invoicingOn(settings, facts.fakeAllowed)) {
    return "off"
  }
  if (order.status === "canceled" || order.canceled_at) {
    return "canceled"
  }
  // Nothing real was sold in a provider's test mode: no tax document for it
  if (paidInTestMode(order) && !facts.testPaymentsInvoiced) {
    return "test_payment"
  }
  if ((order.currency_code ?? "").toLowerCase() !== "try") {
    return "currency"
  }
  if (
    facts.moments.some((moment) =>
      invoiceDue(order, moment, settings, facts.birfaturaShips === true)
    )
  ) {
    return null
  }
  if (facts.advanceOnly && invoicePaid(order)) {
    return null
  }
  if (facts.birfaturaShips === true) {
    return "awaiting_payment"
  }
  if (cashOnDelivery(order)) {
    return "awaiting_delivery"
  }
  return settings.trigger === "shipped" ? "awaiting_shipment" : "awaiting_payment"
}

/** The provider whose test mode took the order's payment (its id), when one did. */
export function testPaymentProvider(order: OrderRow): string | null {
  const payment = paymentsOf(order).find(
    (row) => (row?.data as { test_mode?: unknown } | null | undefined)?.test_mode === true
  )
  return payment?.provider_id ?? null
}
