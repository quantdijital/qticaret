import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MathBN } from "@medusajs/framework/utils"
import {
  fakeInvoicingAllowed,
  invoicePaid,
  invoicingOn,
  isWait,
  saleInvoiceHold,
  testPaymentsInvoiced,
} from "../../lib/invoicing"
import type { InvoiceMoment, InvoiceOrderRow } from "../../lib/invoicing"
import { errorSummary, logger } from "../../lib/logging"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { InvoicingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { TENANT_WEBHOOKS_MODULE } from "../../modules/tenant-webhooks"
import type TenantWebhooksModuleService from "../../modules/tenant-webhooks/service"
import { invoiceTotalsOf } from "./draft-source"

// The rule lives in lib/invoicing/hold.ts: the queue and the order page read the same one
export { invoiceDue } from "../../lib/invoicing"
export type { InvoiceMoment, InvoiceOrderRow as OrderRow } from "../../lib/invoicing"

type Container = Pick<MedusaContainer, "resolve">

export type QueueOutcome = "queued" | "already" | "not_due" | "off"

export async function invoicingOf(container: Container): Promise<InvoicingSettings> {
  const section = await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .readSection("invoicing")
  return section.values as unknown as InvoicingSettings
}

/** What the rule (`saleInvoiceHold`) reads of an order. */
export const HOLD_FIELDS = [
  "status",
  "canceled_at",
  "currency_code",
  "payment_collections.payments.provider_id",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.data",
  "total",
  "version",
  "credit_lines.raw_amount",
  "credit_lines.version",
]

/**
 * Queues an order's sale invoice once it is due (`saleInvoiceHold`): a
 * canceled order, one paid in a provider's test mode (but on a developer's
 * machine with the fake Paraşüt, `testPaymentsInvoiced`), or one in
 * another currency, is never queued. Queuing twice is one invoice (KK3).
 * Its gift card lines are left off and kept on the record as its advance;
 * an order of gift cards alone gets no invoice, only that record
 * (`waived`, `advance_only`), once paid whatever the setting: it has no
 * parcel to wait for (docs/mali-musavir-sorulari.md 3.2, the owner 2026-11-03).
 */
export async function queueSaleInvoice(
  container: Container,
  orderId: string,
  moment: InvoiceMoment
): Promise<QueueOutcome> {
  const settings = await invoicingOf(container)
  const fakeAllowed = fakeInvoicingAllowed()
  if (!invoicingOn(settings, fakeAllowed)) {
    return "off"
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: HOLD_FIELDS,
    filters: { id: orderId },
  })
  const order = data[0] as InvoiceOrderRow | undefined
  if (!order) {
    return "not_due"
  }
  const facts = {
    settings,
    order,
    moments: [moment],
    fakeAllowed,
    testPaymentsInvoiced: testPaymentsInvoiced(settings.provider),
  }
  const hold = saleInvoiceHold(facts)
  // A paid order still waiting may be gift cards alone, due once paid: its lines tell
  if (hold && !(isWait(hold) && invoicePaid(order))) {
    return "not_due"
  }
  const lines = await invoiceTotalsOf(container, orderId)
  if (!lines) {
    return "not_due"
  }
  const advanceOnly = lines.lines === 0 && MathBN.gt(lines.advance, 0)
  if (hold && saleInvoiceHold({ ...facts, advanceOnly })) {
    return "not_due"
  }
  const { id, created } = await container.resolve<EinvoiceModuleService>(EINVOICE_MODULE).enqueue({
    order_id: orderId,
    kind: "sale",
    source_id: orderId,
    provider: settings.provider,
    totals: lines.totals,
    advance: lines.advance,
    advance_only: advanceOnly,
  })
  if (created && settings.provider === "external" && !advanceOnly) {
    await announceInvoice(container, id, orderId, lines.totals.gross)
  }
  return created ? "queued" : "already"
}

/**
 * Tells the shop's own program an invoice waits for it (`invoice.requested`,
 * adr/0034 §9): ids and the total, never the buyer; the program reads the
 * rest with its key. A failure is logged: the program can list what waits.
 */
export async function announceInvoice(
  container: Container,
  invoiceId: string,
  orderId: string,
  total: string
) {
  try {
    const hooks = container.resolve<TenantWebhooksModuleService>(TENANT_WEBHOOKS_MODULE)
    if (!(await hooks.anyTakes("invoice.requested"))) {
      return
    }
    await hooks.enqueue("invoice.requested", `invoice.requested:${invoiceId}`, {
      invoice_id: invoiceId,
      order_id: orderId,
      kind: "sale",
      total,
      currency_code: "try",
    })
  } catch (error) {
    logger.warn({ event: "einvoice.announce_failed", err: errorSummary(error) })
  }
}

/** The order a parcel or a payment belongs to; null when none. */
export async function orderOf(
  container: Container,
  entity: "fulfillment" | "payment",
  id: string
): Promise<string | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity,
    fields: entity === "fulfillment" ? ["order.id"] : ["payment_collection.order.id"],
    filters: { id },
  })
  const row = data[0] as
    | {
        order?: { id?: string } | null
        payment_collection?: { order?: { id?: string } | null } | null
      }
    | undefined
  return row?.order?.id ?? row?.payment_collection?.order?.id ?? null
}
