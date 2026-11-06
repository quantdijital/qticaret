import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest, MedusaRequest } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import {
  AdminGetInvoices,
  AdminPostInvoiceIssued,
  AdminPostInvoiceWaive,
  AdminPostInvoicesRetry,
  AdminPostReturnDocument,
} from "../admin/invoices/validators"
import { StoreGetOrderInvoicePdf } from "../store/orders/[id]/invoice/validators"
import { requireUserActor } from "./actor"
import { optionalCustomer, orderAccess } from "./order-access"
import { requireReauth } from "./reauth"

/**
 * F8 (adr/0034 §9): the shop's invoices, for staff and for a key with
 * `invoices:read` / `invoices:write` (the routes' scopes, lib/api-access).
 * A PDF comes as it is: Medusa parses nothing for it.
 */
const noQuery = validateAndTransformQuery(AdminGetDashboardNoQuery, {})
const emptyBody = validateAndTransformBody(z.object({}).strict())

// Staff prove themselves again to read a buyer's tax id, as for the billing profile's;
// a program's key, which reads what waits for it, is never asked (docs/04)
const staffOnly = (req: MedusaRequest) =>
  (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_type === "user"

export const INVOICE_ROUTES = [
  // The order's own customer, or the holder of its key (the invoice e-mail links its page)
  {
    matcher: "/store/orders/:id/invoice",
    methods: ["GET" as const],
    middlewares: [optionalCustomer, orderAccess, noQuery],
  },
  {
    matcher: "/store/orders/:id/invoice/pdf",
    methods: ["GET" as const],
    middlewares: [
      optionalCustomer,
      orderAccess,
      validateAndTransformQuery(StoreGetOrderInvoicePdf, {}),
    ],
  },
  {
    matcher: "/admin/invoices",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetInvoices, {})],
  },
  ...["/admin/invoices/:id", "/admin/invoices/:id/pdf"].map((matcher) => ({
    matcher,
    methods: ["GET" as const],
    middlewares: [noQuery],
  })),
  {
    matcher: "/admin/invoices/:id/draft",
    methods: ["GET" as const],
    middlewares: [noQuery, requireReauth(staffOnly)],
  },
  {
    matcher: "/admin/invoices/:id/retry",
    methods: ["POST" as const],
    middlewares: [emptyBody],
  },
  // The queue's picked stopped invoices tried again at once; people only
  {
    matcher: "/admin/invoices/retry",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostInvoicesRetry)],
  },
  {
    matcher: "/admin/invoices/:id/issued",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostInvoiceIssued)],
  },
  {
    matcher: "/admin/invoices/:id/return-document",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostReturnDocument)],
  },
  {
    matcher: "/admin/invoices/:id/waive",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostInvoiceWaive)],
  },
  {
    matcher: "/admin/invoices/:id/pdf",
    methods: ["POST" as const],
    bodyParser: false as const,
    middlewares: [],
  },
]
