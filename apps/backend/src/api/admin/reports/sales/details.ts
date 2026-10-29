import type { MedusaContainer } from "@medusajs/framework/types"
import {
  brandSales,
  promotionEffect,
  returnRates,
  sourceSales,
} from "../../../../lib/reports/sales"
import type { SalesOrder } from "../../../../lib/reports/sales"
import { RETURN_REQUESTS_MODULE } from "../../../../modules/return-requests"
import type ReturnRequestsModuleService from "../../../../modules/return-requests/service"
import { COUNTED_RETURN_STATUSES } from "../../../../modules/return-requests/states"
import { TRAFFIC_SOURCES_MODULE } from "../../../../modules/traffic-sources"
import type TrafficSourcesModuleService from "../../../../modules/traffic-sources/service"

/** What the sales report reads of an order beyond the dashboard (F11.2); no personal data. */
export const SALES_DETAIL_FIELDS = [
  "items.product.brand.id",
  "items.product.brand.name",
  "items.adjustments.code",
  "items.adjustments.amount",
  "shipping_methods.adjustments.code",
  "shipping_methods.adjustments.amount",
  "cart.id",
  "payment_collections.refunded_amount",
]

/** How many brands the report lists before "the rest". */
const BRANDS = 50

/**
 * The sales report's other cuts over the period's sold orders: brands,
 * promotion codes, returns and exchanges asked for, and traffic sources.
 */
export async function salesDetails(scope: MedusaContainer, orders: readonly SalesOrder[]) {
  const ids = orders.map((order) => order.id)
  const cartIds = orders.flatMap((order) => (order.cart ? [order.cart.id] : []))
  const [requests, sources] = await Promise.all([
    ids.length > 0
      ? scope
          .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
          .listReturnRequests(
            { order_id: ids, status: [...COUNTED_RETURN_STATUSES] },
            { select: ["order_id", "kind"] }
          )
      : Promise.resolve([]),
    scope.resolve<TrafficSourcesModuleService>(TRAFFIC_SOURCES_MODULE).sourcesOf(cartIds),
  ])
  return {
    brands: brandSales(orders, BRANDS),
    promotions: promotionEffect(orders),
    returns: returnRates(orders, requests),
    sources: sourceSales(orders, sources),
  }
}

export type SalesDetails = Awaited<ReturnType<typeof salesDetails>>
