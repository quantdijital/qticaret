import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import { AdminGetInvoices, AdminPostInvoiceIssued } from "../admin/invoices/validators"
import { optionalCustomer, orderAccess } from "./order-access"

/**
 * F8 (adr/0034 §9): the shop's invoices, for staff and for a key with
 * `invoices:read` / `invoices:write` (the routes' scopes, lib/api-access).
 * A PDF comes as it is: Medusa parses nothing for it.
 */
const noQuery = validateAndTransformQuery(AdminGetDashboardNoQuery, {})

export const INVOICE_ROUTES = [
  // The order's own customer, or the holder of its key (the invoice e-mail links its page)
  ...["/store/orders/:id/invoice", "/store/orders/:id/invoice/pdf"].map((matcher) => ({
    matcher,
    methods: ["GET" as const],
    middlewares: [optionalCustomer, orderAccess, noQuery],
  })),
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
