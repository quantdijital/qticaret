import type { MedusaContainer } from "@medusajs/framework/types"
import type { InvoiceVars } from "../../../lib/messaging/templates"
import { logger } from "../../../lib/logging"
import { EINVOICE_MODULE } from "../../../modules/einvoice"
import type EinvoiceModuleService from "../../../modules/einvoice/service"
import { loadOrderMessage } from "./order"
import type { Loaded } from "./types"

const DOCUMENTS: Readonly<Record<string, string>> = {
  e_archive: "e-Arşiv",
  e_invoice: "e-Fatura",
}

/**
 * "Faturanız hazır" for an issued invoice (F8, adr/0034 §7): its number,
 * and the order's page and address as the order's own message has them.
 */
export async function loadInvoiceMessage(
  container: Pick<MedusaContainer, "resolve">,
  invoiceId: string
): Promise<Loaded<InvoiceVars> | null> {
  const [invoice] = await container
    .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    .listInvoices({ id: invoiceId }, { take: 1 })
  if (invoice?.status !== "issued" || !invoice.number) {
    logger.info({ event: "messaging.not_sent", template: "order.invoiced", reason: "not_issued" })
    return null
  }
  // A return's document (a gider pusulası, a company's return invoice) is the shop's paper, not the buyer's invoice
  if (invoice.kind !== "sale") {
    logger.info({ event: "messaging.not_sent", template: "order.invoiced", reason: "not_sale" })
    return null
  }
  const order = await loadOrderMessage(container, invoice.order_id)
  if (!order) {
    return null
  }
  return {
    vars: {
      number: order.vars.number,
      customerName: order.vars.customerName,
      invoiceNumber: invoice.number,
      documentName: DOCUMENTS[invoice.document_type ?? ""] ?? "e-Arşiv",
      orderUrl: order.vars.orderUrl ?? null,
    },
    recipients: { email: order.recipients.email ?? null },
    receiverId: order.receiverId,
    resourceType: "order",
  }
}
