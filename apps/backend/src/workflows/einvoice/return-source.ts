import type { MedusaContainer } from "@medusajs/framework/types"
import { invoiceDraft, returnedOrder } from "../../lib/invoicing"
import type { DraftResult, InvoiceOrder, InvoiceProfile, ReturnedLine } from "../../lib/invoicing"
import { cameBack } from "../../lib/orders/returns"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"
import { RETURN_REQUESTS_MODULE } from "../../modules/return-requests"
import type ReturnRequestsModuleService from "../../modules/return-requests/service"

type Container = Pick<MedusaContainer, "resolve">

/** What came back of a return request: its lines, and whether its shipping was given back. */
export async function returnedOf(container: Container, returnRequestId: string) {
  const [request] = await container
    .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
    .listReturnRequests({ id: returnRequestId }, { take: 1 })
  return request
    ? {
        request,
        lines: cameBack(request) as ReturnedLine[],
        shipping: request.refund_shipping,
      }
    : null
}

/**
 * A return's document draft (the accountant, 2026-10-31): the buyer as on
 * the sale, only what came back, no carrier, and the sale invoice it
 * belongs to. Null when the return or its sale invoice is gone.
 */
export async function returnDraft(
  container: Container,
  order: InvoiceOrder,
  invoice: { source_id: string; original_invoice_id: string | null; document_type: string | null },
  context: { store_url: string | null; profile: InvoiceProfile | null }
): Promise<DraftResult | null> {
  const returned = await returnedOf(container, invoice.source_id)
  const [sale] = invoice.original_invoice_id
    ? await container
        .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
        .listInvoices({ id: invoice.original_invoice_id }, { take: 1 })
    : []
  if (!returned || !sale) {
    return null
  }
  const result = invoiceDraft(
    returnedOrder(order, returned.lines, returned.shipping),
    context.profile,
    { store_url: context.store_url, shipment: null }
  )
  if (!("draft" in result)) {
    return result
  }
  return {
    draft: {
      ...result.draft,
      return_of: {
        document: invoice.document_type === "return_invoice" ? "return_invoice" : "expense_voucher",
        number: sale.number ?? null,
        issued_on: sale.issued_at ? new Date(sale.issued_at).toISOString().slice(0, 10) : null,
      },
    },
  }
}
