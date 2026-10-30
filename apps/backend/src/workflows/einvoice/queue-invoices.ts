import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { fakeInvoicingAllowed } from "../../lib/invoicing"
import { COD_PAYMENT_PROVIDER_ID } from "../../lib/payments/checkout"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { InvoicingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { invoiceTotalsOf } from "./draft-source"

type Container = Pick<MedusaContainer, "resolve">

/** What made an order due: placed, its payment taken (a transfer confirmed), or its parcel gone. */
export type InvoiceMoment = "placed" | "paid" | "shipped"

export type QueueOutcome = "queued" | "already" | "not_due" | "off"

interface OrderRow {
  status?: string | null
  canceled_at?: string | Date | null
  payment_collections?:
    | ({
        payments?:
          ({ provider_id?: string | null; captured_at?: string | Date | null } | null)[] | null
      } | null)[]
    | null
}

async function invoicingOf(container: Container): Promise<InvoicingSettings> {
  const section = await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .readSection("invoicing")
  return section.values as unknown as InvoicingSettings
}

/**
 * Paid as far as invoicing goes: its money taken, or cash at the door
 * (invoiced on its way, the payment collected on delivery). A transfer
 * waits for staff to confirm it.
 */
function paid(order: OrderRow): boolean {
  const payments = (order.payment_collections ?? []).flatMap(
    (collection) => collection?.payments ?? []
  )
  return payments.some(
    (payment) => Boolean(payment?.captured_at) || payment?.provider_id === COD_PAYMENT_PROVIDER_ID
  )
}

/**
 * Queues an order's sale invoice once it is due by the shop's setting
 * (adr/0034 §8): when its parcel leaves (the default), or once it is
 * placed and paid. A canceled order, or one in another currency, is
 * never queued. Queuing twice is one invoice (KK3).
 */
export async function queueSaleInvoice(
  container: Container,
  orderId: string,
  moment: InvoiceMoment
): Promise<QueueOutcome> {
  const settings = await invoicingOf(container)
  if (settings.provider === "none" || (settings.provider === "fake" && !fakeInvoicingAllowed())) {
    return "off"
  }
  if ((moment === "shipped") !== (settings.trigger === "shipped")) {
    return "not_due"
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      "status",
      "canceled_at",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.captured_at",
    ],
    filters: { id: orderId },
  })
  const order = data[0] as OrderRow | undefined
  if (!order || order.status === "canceled" || order.canceled_at) {
    return "not_due"
  }
  if (moment !== "shipped" && !paid(order)) {
    return "not_due"
  }
  const lines = await invoiceTotalsOf(container, orderId)
  if (lines?.currency.toLowerCase() !== "try") {
    return "not_due"
  }
  const { created } = await container.resolve<EinvoiceModuleService>(EINVOICE_MODULE).enqueue({
    order_id: orderId,
    kind: "sale",
    source_id: orderId,
    provider: settings.provider,
    totals: lines.totals,
  })
  return created ? "queued" : "already"
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
