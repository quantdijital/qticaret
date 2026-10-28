import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { requireUserActor } from "../http/actor"
import { rateLimit } from "../http/rate-limit"
import { AdminGetDashboardNoQuery, AdminGetDashboardOverview } from "./dashboard/validators"
import { AdminGetOrderBoard } from "./order-board/validators"
import { AdminGetBulkLabels } from "./shipping-labels/validators"
import { AdminPostShipOrder, AdminPostShipOrders } from "./orders/[id]/ship/validators"
import { AdminPostPriceListDiscount } from "./price-lists/[id]/discount/validators"
import { AdminPostPromotionOffer } from "./promotions/[id]/offer/validators"
import { AdminGetPriceHistory } from "./products/[id]/price-history/validators"
import { AdminGetStockBoard } from "./stock-board/validators"

const NO_QUERY_READS = [
  "/admin/dashboard/tasks",
  "/admin/dashboard/recent-orders",
  "/admin/dashboard/catalog-health",
  "/admin/order-board/:id",
  "/admin/orders/:id/money",
  "/admin/price-lists/:id/lines",
]

/**
 * The panel's own routes (adr/0022): read models for its screens and the
 * actions that are more than one Medusa call. All for people: they show
 * shop revenue and customers' names, or act on orders.
 */
export const PANEL_ROUTES = [
  ...["/admin/dashboard/overview", "/admin/reports/sales"].map((matcher) => ({
    matcher,
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetDashboardOverview, {})],
  })),
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
  {
    matcher: "/admin/products/:id/price-history",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetPriceHistory, {})],
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
