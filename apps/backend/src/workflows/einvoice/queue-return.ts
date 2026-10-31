import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { notificationText } from "../../lib/notifications/messages"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"
import { RETURN_REQUESTS_MODULE } from "../../modules/return-requests"
import type ReturnRequestsModuleService from "../../modules/return-requests/service"
import { invoiceTotalsOf } from "./draft-source"
import { EXCHANGE_CAME_BACK, saleReturned } from "./queue-exchange"
import { returnedOf } from "./return-source"

type Container = Pick<MedusaContainer, "resolve">

export type ReturnDocument = "expense_voucher" | "return_invoice"

/** Tells every admin, in the panel's bell, a return's document waits for them. */
async function alertDocumentDue(
  container: Container,
  invoiceId: string,
  orderId: string,
  document: ReturnDocument
) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["display_id"],
    filters: { id: orderId },
  })
  const order = String((data[0] as { display_id?: number } | undefined)?.display_id ?? "")
  await container
    .resolve(Modules.NOTIFICATION)
    .createNotifications({
      to: "",
      channel: "feed",
      template: "admin-ui",
      trigger_type: `einvoice.${document}_due`,
      resource_id: invoiceId,
      data: {
        kind: "einvoice_return_document",
        document,
        order_id: orderId,
        display_id: order,
        ...notificationText(`einvoice.${document}_due`, { order }),
      },
    })
    .catch((error: unknown) => {
      logger.warn({ event: "einvoice.alert_failed", err: errorSummary(error) })
    })
}

/**
 * A return's document, queued once its money is given back (the shop's
 * accountant, 2026-10-31; adr/0034 addendum): for an order whose sale
 * invoice was issued, the gider pusulası the shop issues to a person who
 * sent goods back (an e-Arşiv's buyer), or the return invoice a company
 * issues to the shop (an e-Fatura's buyer). Only the lines and quantities
 * that came back, the sale invoice they were sold on named (the first
 * sale's, or an exchange's). Always the shop's to issue and write back.
 * An exchange's return is due once its goods came back, whether money
 * went either way or none (5.4: a return and a new sale).
 */
export async function queueReturnDocument(
  container: Container,
  returnRequestId: string
): Promise<"queued" | "already" | "not_due"> {
  const returned = await returnedOf(container, returnRequestId)
  const due =
    returned?.request.kind === "exchange"
      ? EXCHANGE_CAME_BACK.includes(returned.request.status)
      : returned?.request.status === "refunded"
  if (!returned || !due) {
    return "not_due"
  }
  const orderId = returned.request.order_id
  const invoices = container.resolve<EinvoiceModuleService>(EINVOICE_MODULE)
  const sale = await saleReturned(
    container,
    orderId,
    returned.lines.map((line) => line.line_item_id)
  )
  if (sale?.document_type !== "e_archive" && sale?.document_type !== "e_invoice") {
    return "not_due"
  }
  const document: ReturnDocument =
    sale.document_type === "e_invoice" ? "return_invoice" : "expense_voucher"
  const amounts = await invoiceTotalsOf(container, orderId, returned)
  if (!amounts || Number(amounts.totals.gross) <= 0) {
    return "not_due"
  }
  const { id, created } = await invoices.enqueue({
    order_id: orderId,
    kind: "return",
    source_id: returnRequestId,
    provider: "external",
    totals: amounts.totals,
    original_invoice_id: sale.id,
    document_type: document,
  })
  if (created) {
    await alertDocumentDue(container, id, orderId, document)
  }
  return created ? "queued" : "already"
}

/**
 * Every return of an order that came back (a return refunded, an
 * exchange received) queued for its document, once the sale it gives
 * back is issued (the F15 security review): one that came before (a sale
 * entered by hand later) queued none. Queuing twice is one document; a
 * failure is logged, the hourly sweep tries the day's again.
 */
export async function queueOrderReturnDocuments(container: Container, orderId: string) {
  const service = container.resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
  const [returns, exchanges] = await Promise.all([
    service.listReturnRequests(
      { order_id: orderId, kind: "return", status: "refunded" },
      { select: ["id"], take: 50 }
    ),
    service.listReturnRequests(
      { order_id: orderId, kind: "exchange", status: EXCHANGE_CAME_BACK },
      { select: ["id"], take: 50 }
    ),
  ])
  for (const request of [...returns, ...exchanges]) {
    try {
      await queueReturnDocument(container, request.id)
    } catch (error) {
      logger.warn({ event: "einvoice.return_queue_failed", err: errorSummary(error) })
    }
  }
}
