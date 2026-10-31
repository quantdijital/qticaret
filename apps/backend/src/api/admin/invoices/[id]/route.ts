import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { EINVOICE_MODULE } from "../../../../modules/einvoice"
import type EinvoiceModuleService from "../../../../modules/einvoice/service"
import { programMayReach } from "../reach"
import { invoiceView } from "../view"

/** GET /admin/invoices/:id: one invoice record; to a program, a sale's only. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const [row] = await req.scope
    .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    .listInvoices({ id: req.params["id"] ?? "" }, { take: 1 })
  if (!row || !programMayReach(req, row.kind)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "einvoice.unknown")
  }
  res.json({ invoice: invoiceView(row) })
}
