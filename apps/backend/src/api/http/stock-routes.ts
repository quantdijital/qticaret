import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminGetStockMovements, AdminPostStockWatch } from "../admin/stock-items/validators"
import { AdminCreateWarehouse, AdminUpdateWarehouse } from "../admin/warehouses/validators"
import { GetTrDistricts, GetTrProvinces } from "../tr-address/validators"
import { BACKORDER_CLAIMS, backorderGate } from "../validation/backorder-gate"
import { keepStockedLocation } from "../validation/stock-location-delete"
import { existingLocationAddress, validateTrAddresses } from "../validation/tr-address"

/**
 * F3.7: warehouses, through the panel's routes or Medusa's own, guarded: a
 * Turkish address must agree with the reference data (F1.4), and a
 * warehouse that still matters is not deleted. The panel's address forms
 * read the reference data here. F3.8: stock history, thresholds, preorder.
 */
export const STOCK_ROUTES = [
  // The panel's warehouse actions (adr/0022): one workflow each
  {
    matcher: "/admin/warehouses",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminCreateWarehouse), validateTrAddresses(["address"])],
  },
  {
    matcher: "/admin/warehouses/:id",
    methods: ["POST" as const],
    middlewares: [
      validateAndTransformBody(AdminUpdateWarehouse),
      validateTrAddresses(["address"], existingLocationAddress),
    ],
  },
  {
    matcher: "/admin/stock-locations",
    methods: ["POST" as const],
    middlewares: [validateTrAddresses(["address"])],
  },
  {
    matcher: "/admin/stock-locations/:id",
    methods: ["POST" as const],
    middlewares: [validateTrAddresses(["address"], existingLocationAddress)],
  },
  {
    matcher: "/admin/stock-locations/:id",
    methods: ["DELETE" as const],
    middlewares: [keepStockedLocation],
  },
  // F3.8: an item's stock history and its own low-stock threshold
  {
    matcher: "/admin/stock-items/:id/movements",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetStockMovements, {})],
  },
  {
    matcher: "/admin/stock-items/:id/watch",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostStockWatch)],
  },
  // F3.8: selling past stock needs the preorder flag, whichever route sets it
  ...Object.entries(BACKORDER_CLAIMS).map(([matcher, claimsOf]) => ({
    matcher,
    methods: ["POST" as const],
    middlewares: [backorderGate(claimsOf)],
  })),
  {
    matcher: "/admin/tr-address/provinces",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(GetTrProvinces, {})],
  },
  {
    matcher: "/admin/tr-address/districts",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(GetTrDistricts, {})],
  },
]
