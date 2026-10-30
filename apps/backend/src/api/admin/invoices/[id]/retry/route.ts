import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { retryInvoiceWorkflow } from "../../../../../workflows/einvoice/write-back"

/** POST /admin/invoices/:id/retry: a stopped invoice tried again from where it stopped. */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  await retryInvoiceWorkflow(req.scope).run({ input: { invoice_id: req.params["id"] ?? "" } })
  res.json({ retried: true })
}
