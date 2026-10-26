import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { requireUserActor } from "../http/actor"
import { AdminGetDashboardNoQuery, AdminGetDashboardOverview } from "./dashboard/validators"
import { AdminGetOrderBoard } from "./order-board/validators"
import { AdminPostShipOrder } from "./orders/[id]/ship/validators"
import { AdminPostPriceListDiscount } from "./price-lists/[id]/discount/validators"
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
  {
    matcher: "/admin/price-lists/:id/discount",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostPriceListDiscount)],
  },
]
