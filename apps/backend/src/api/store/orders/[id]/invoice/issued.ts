import type { MedusaRequest } from "@medusajs/framework/http"
import { EINVOICE_MODULE } from "../../../../../modules/einvoice"
import type EinvoiceModuleService from "../../../../../modules/einvoice/service"
import { orderAccessOf } from "../../../../http/order-access"

/** The order's issued sale invoice, for its own customer or the holder of its key; null when none. */
export async function issuedInvoiceOf(req: MedusaRequest) {
  const access = orderAccessOf(req)
  const [invoice] = await req.scope
    .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    .listInvoices({ order_id: access.order_id, kind: "sale", status: "issued" }, { take: 1 })
  return invoice ?? null
}
