import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { requireUserActor } from "../http/actor"
import { rateLimit } from "../http/rate-limit"
import { AdminGetDashboardNoQuery, AdminGetDashboardOverview } from "./dashboard/validators"
import { AdminPostAccountingRetry } from "./accounting/validators"
import { AdminPostApiKey, AdminPostApiKeyRevoke } from "./api-access/validators"
import { AdminGetReportRange } from "./reports/validators"
import { AdminPostStatementCheck } from "./reports/statements/validators"
import { AdminGetOrderBoard } from "./order-board/validators"
import { AdminPostOrderExport } from "./order-board/export/validators"
import { AdminGetPackingSlips } from "./packing-slips/validators"
import { AdminGetGlobalSearch } from "./global-search/validators"
import { AdminGetBulkLabels } from "./shipping-labels/validators"
import { AdminPostCustomerConsent } from "./customers/[id]/consents/validators"
import { AdminPostDeliverOrders } from "./order-board/deliver/validators"
import { AdminPostShipOrder, AdminPostShipOrders } from "./orders/[id]/ship/validators"
import { AdminPostPriceListDiscount } from "./price-lists/[id]/discount/validators"
import { AdminPostPromotionOffer } from "./promotions/[id]/offer/validators"
import { AdminGetPriceHistory } from "./products/[id]/price-history/validators"
import { AdminPostSalePrices } from "./products/[id]/sale-prices/validators"
import { AdminGetStockBoard } from "./stock-board/validators"

const NO_QUERY_READS = [
  "/admin/accounting",
  "/admin/api-access",
  "/admin/openapi.json",
  "/admin/dashboard/tasks",
  "/admin/dashboard/pending",
  "/admin/dashboard/recent-orders",
  "/admin/dashboard/catalog-health",
  "/admin/category-counts",
  "/admin/order-board/:id",
  "/admin/orders/:id/money",
  "/admin/price-lists/:id/lines",
  "/admin/products/:id/sale-prices",
  "/admin/seo/setup",
  "/admin/staff/me",
]

/**
 * The panel's own routes (adr/0022): read models for its screens and the
 * actions that are more than one Medusa call. All for people: they show
 * shop revenue and customers' names, or act on orders.
 */
export const PANEL_ROUTES = [
  {
    matcher: "/admin/dashboard/overview",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetDashboardOverview, {})],
  },
  // F11.1, F11.3, F11.4: reports over a preset period or the days asked for
  ...[
    "/admin/reports/sales",
    "/admin/reports/finance",
    "/admin/reports/statements",
    "/admin/reports/stock",
    "/admin/reports/search",
  ].map((matcher) => ({
    matcher,
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetReportRange, {})],
  })),
  // F11.3: a day's statement checked again asks the provider: the provider check's budget
  {
    matcher: "/admin/reports/statements",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      rateLimit(() => RATE_LIMIT_PROFILES.provider_check, {
        identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
      }),
      validateAndTransformBody(AdminPostStatementCheck),
    ],
  },
  ...NO_QUERY_READS.map((matcher) => ({
    matcher,
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetDashboardNoQuery, {})],
  })),
  // The order list by stage: customers' names, a recorded read (SENSITIVE_READS)
  {
    matcher: "/admin/order-board",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetOrderBoard, {})],
  },
  // The list's filtered orders as a file, the owner's alone (permission-rules OWNER_ONLY)
  {
    matcher: "/admin/order-board/export",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostOrderExport)],
  },
  // Packing slips and the pick list: addresses and add-on texts, a recorded read (SENSITIVE_READS)
  {
    matcher: "/admin/packing-slips",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetPackingSlips, {})],
  },
  // F12.9: the search box; customers' names, a recorded read (SENSITIVE_READS)
  {
    matcher: "/admin/global-search",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetGlobalSearch, {})],
  },
  {
    matcher: "/admin/stock-board",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetStockBoard, {})],
  },
  {
    matcher: "/admin/orders/:id/ship",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostShipOrder)],
  },
  // F12.3: the shop's own deliveries marked delivered at once; people only
  {
    matcher: "/admin/order-board/deliver",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostDeliverOrders)],
  },
  // F7.7: several orders at once; each may ask a carrier, so a small budget per staff member
  {
    matcher: "/admin/order-board/ship",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      rateLimit(() => RATE_LIMIT_PROFILES.bulk_ship, {
        identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
      }),
      validateAndTransformBody(AdminPostShipOrders),
    ],
  },
  // The picked parcels' labels in one PDF: recipients' addresses, a recorded read (SENSITIVE_READS)
  {
    matcher: "/admin/shipping-labels",
    methods: ["GET" as const],
    middlewares: [
      requireUserActor,
      rateLimit(() => RATE_LIMIT_PROFILES.bulk_ship, {
        identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
      }),
      validateAndTransformQuery(AdminGetBulkLabels, {}),
    ],
  },
  // F11.6: API keys are made and revoked by people only (audited as every write)
  {
    matcher: "/admin/api-access",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostApiKey)],
  },
  {
    matcher: "/admin/api-access/:id/revoke",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostApiKeyRevoke)],
  },
  // A revoked key removed from the list; an active one is refused
  {
    matcher: "/admin/api-access/:id",
    methods: ["DELETE" as const],
    middlewares: [requireUserActor],
  },
  // F11.5: a stopped accounting record tried again (audited as every write)
  {
    matcher: "/admin/accounting/syncs/:id/retry",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostAccountingRetry)],
  },
  // F9.5: a customer's commercial consent, recorded by staff (audited as every write)
  {
    matcher: "/admin/customers/:id/consents",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostCustomerConsent)],
  },
  {
    matcher: "/admin/customers/:id/consents",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/products/:id/price-history",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetPriceHistory, {})],
  },
  // adr/0086: a variant's sale price, checked and worked out on the server
  {
    matcher: "/admin/products/:id/sale-prices",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostSalePrices)],
  },
  {
    matcher: "/admin/price-lists/:id/discount",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostPriceListDiscount)],
  },
  {
    matcher: "/admin/promotions/:id/offer",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostPromotionOffer)],
  },
]
