import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { retryInvoices } from "../../../../workflows/einvoice/retry-invoices"
import type { AdminPostInvoicesRetryType } from "../validators"

/**
 * POST /admin/invoices/retry: "Yeniden dene" for the stopped invoices
 * picked on the queue, each as its own retry would; answers each one's
 * outcome. People only (the owner and admins, as the single retry).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostInvoicesRetryType>,
  res: MedusaResponse
): Promise<void> {
  res.json({ results: await retryInvoices(req.scope, req.validatedBody.invoice_ids) })
}
