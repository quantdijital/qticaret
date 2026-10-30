import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminGetInvoices, AdminPostInvoiceIssued } from "../admin/invoices/validators"

/**
 * F8 (adr/0034 §9): the shop's invoices, for staff and for a key with
 * `invoices:read` / `invoices:write` (the routes' scopes, lib/api-access).
 * A PDF comes as it is: Medusa parses nothing for it.
 */
export const INVOICE_ROUTES = [
  {
    matcher: "/admin/invoices",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetInvoices, {})],
  },
  {
    matcher: "/admin/invoices/:id/issued",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostInvoiceIssued)],
  },
  {
    matcher: "/admin/invoices/:id/pdf",
    methods: ["POST" as const],
    bodyParser: false as const,
    middlewares: [],
  },
]
