import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { EINVOICE_MODULE } from "../../../modules/einvoice"
import type EinvoiceModuleService from "../../../modules/einvoice/service"
import { invoiceView } from "./view"
import type { AdminGetInvoicesType } from "./validators"

/**
 * GET /admin/invoices (F8, adr/0034 §9): the shop's invoices, the failed
 * first, then the newest; for staff, and for a key with `invoices:read`
 * (an external program lists what waits for it). No buyer in them.
 */
export async function GET(
  req: MedusaRequest<unknown, AdminGetInvoicesType>,
  res: MedusaResponse
): Promise<void> {
  const { limit, offset, ...filters } = req.validatedQuery
  const [rows, count] = await req.scope
    .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    .listAndCountInvoices(filters, {
      take: limit,
      skip: offset,
      order: { status: "ASC", created_at: "DESC" },
    })
  res.json({ invoices: rows.map(invoiceView), count, limit, offset })
}
