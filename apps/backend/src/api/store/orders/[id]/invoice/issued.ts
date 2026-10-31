import type { MedusaRequest } from "@medusajs/framework/http"
import { EINVOICE_MODULE } from "../../../../../modules/einvoice"
import type EinvoiceModuleService from "../../../../../modules/einvoice/service"
import { orderAccessOf } from "../../../../http/order-access"

const invoicesOf = (req: MedusaRequest) => req.scope.resolve<EinvoiceModuleService>(EINVOICE_MODULE)

/**
 * The order's issued sale invoice, for its own customer or the holder of
 * its key: its first sale's, or the exchange's named (E6b); null when none.
 */
export async function issuedInvoiceOf(req: MedusaRequest, invoiceId?: string) {
  const { order_id } = orderAccessOf(req)
  const [invoice] = await invoicesOf(req).listInvoices(
    invoiceId
      ? { id: invoiceId, order_id, kind: "sale", status: "issued" }
      : { order_id, kind: "sale", source_id: order_id, status: "issued" },
    { take: 1 }
  )
  return invoice ?? null
}

/** The order's exchanges' issued sale invoices (E6b), oldest first. */
export async function issuedExchangeInvoicesOf(req: MedusaRequest) {
  const { order_id } = orderAccessOf(req)
  const invoices = await invoicesOf(req).listInvoices(
    { order_id, kind: "sale", status: "issued" },
    { order: { issued_at: "ASC" }, take: 20 }
  )
  return invoices.filter((invoice) => invoice.source_id !== order_id)
}
