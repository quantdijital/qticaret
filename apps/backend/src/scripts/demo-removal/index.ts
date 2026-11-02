import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../../lib/logging"
import { removeDemoCategories, removeDemoOrders, removeDemoProducts } from "./catalog"
import {
  clearDemoWarehouseAddress,
  removeDemoShippingOptions,
  removeE2eStaff,
  removeLeftoverImportChecks,
} from "./shop"

export interface DemoRemovalSummary {
  orders: number
  invoices: number
  products: number
  productsKept: string[]
  categories: number
  categoriesKept: string[]
  shippingOptions: number
  shippingOptionsKeptForCheckout: number
  warehouseAddresses: number
  e2eStaff: number
  e2eStaffKept: number
  importChecks: number
}

/**
 * Takes the demo seed's records and what e2e runs left out of a
 * development database, so the shop owner sees only their own. Safe to
 * run again: what is gone is not found twice. Kept on purpose: the "Demo
 * storefront" publishable key (the storefront's local setup uses it), the
 * warehouse itself, the storefront frame's texts (the shop's to edit).
 * Orders first: their reservations hold the demo products' stock.
 */
export async function removeDemo(container: MedusaContainer): Promise<DemoRemovalSummary> {
  const { orders, invoices } = await removeDemoOrders(container)
  const products = await removeDemoProducts(container)
  const categories = await removeDemoCategories(container)
  const shipping = await removeDemoShippingOptions(container)
  const warehouseAddresses = await clearDemoWarehouseAddress(container)
  const staff = await removeE2eStaff(container)
  const importChecks = await removeLeftoverImportChecks(container, new Set(staff.removed))
  const summary: DemoRemovalSummary = {
    orders,
    invoices,
    products: products.removed,
    productsKept: products.kept,
    categories: categories.removed,
    categoriesKept: categories.kept,
    shippingOptions: shipping.removed,
    shippingOptionsKeptForCheckout: shipping.keptForCheckout,
    warehouseAddresses,
    e2eStaff: staff.removed.length,
    e2eStaffKept: staff.failed,
    importChecks,
  }
  if (shipping.keptForCheckout > 0) {
    logger.warn(
      { event: "demo.shipping_kept", count: shipping.keptForCheckout },
      "demo shipping options kept: the shop has no other way to ship yet"
    )
  }
  logger.info({ event: "demo.removed", ...summary }, "demo data removed")
  return summary
}
