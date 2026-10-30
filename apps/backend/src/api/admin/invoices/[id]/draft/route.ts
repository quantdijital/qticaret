import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ConflictError } from "../../../../../lib/errors"
import { EINVOICE_MODULE } from "../../../../../modules/einvoice"
import type EinvoiceModuleService from "../../../../../modules/einvoice/service"
import { invoiceDraftFor } from "../../../../../workflows/einvoice/draft-source"

/**
 * GET /admin/invoices/:id/draft (adr/0034 §9): the invoice an external
 * program is to issue, as we computed it: lines, totals, buyer (tax id
 * included), how it was paid, the carrier. Only an external program's
 * invoice; the read is recorded (sensitive read).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const [row] = await req.scope
    .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    .listInvoices({ id: req.params["id"] ?? "" }, { take: 1 })
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "einvoice.unknown")
  }
  if (row.provider !== "external") {
    throw new ConflictError("einvoice.not_external")
  }
  // What waits to be issued only: a key never pages through the shop's buyers of the past
  if (row.status !== "pending" && row.status !== "failed") {
    throw new ConflictError("einvoice.not_pending")
  }
  const result = await invoiceDraftFor(req.scope, row)
  res.setHeader("Cache-Control", "no-store")
  res.json(
    "draft" in result
      ? { draft: result.draft, problems: [] }
      : { draft: null, problems: result.problems }
  )
}
