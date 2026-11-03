import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../../lib/logging"
import {
  findDemoCategories,
  findDemoOrders,
  findDemoProducts,
  removeDemoCategories,
  removeDemoOrders,
  removeDemoProducts,
} from "./catalog"
import { describeDemoPlan } from "./plan"
import type { DemoRemovalPlan } from "./plan"
import {
  clearDemoWarehouseAddresses,
  findDemoShippingOptions,
  findDemoWarehouses,
  findE2eStaff,
  findLeftoverImportChecks,
  removeDemoShippingOptions,
  removeE2eStaff,
  removeLeftoverImportChecks,
} from "./shop"

export {
  ALLOW_FLAG,
  CONFIRM_FLAG,
  ORDERED_PRODUCTS_FLAG,
  demoRemovalMode,
  describeDemoPlan,
  orderedProductsMode,
} from "./plan"
export type { DemoRemovalPlan } from "./plan"
export { removeOrderedDemoProducts } from "./ordered"
export type { OrderedRemovalSummary } from "./ordered"

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
  /** Records with a demo handle or name the seed did not make (or the shop changed): kept. */
  skipped: number
}

/**
 * What `demo:remove` would take out of the database, read whole before
 * anything goes. Only what the demo seed made (its mark, or made before
 * the mark, unchanged) and what e2e runs left; a shop's own record that
 * shares a demo handle or name is kept and named in `skipped`.
 */
export async function planDemoRemoval(container: MedusaContainer): Promise<DemoRemovalPlan> {
  const orders = await findDemoOrders(container)
  const products = await findDemoProducts(container)
  const categories = await findDemoCategories(
    container,
    new Set(products.found.map((product) => product.id))
  )
  const shipping = await findDemoShippingOptions(container)
  const e2eStaff = await findE2eStaff(container)
  return {
    orders,
    products: products.found,
    categories: categories.found,
    categoriesKept: categories.kept,
    shippingOptions: shipping.found,
    shippingOptionsKeptForCheckout: shipping.keptForCheckout,
    warehouses: await findDemoWarehouses(container),
    e2eStaff,
    importChecks: await findLeftoverImportChecks(
      container,
      new Set(e2eStaff.map((user) => user.id))
    ),
    skipped: [
      ...products.skipped.map((label) => ({ kind: "product" as const, label })),
      ...categories.skipped.map((label) => ({ kind: "category" as const, label })),
      ...shipping.skipped.map((label) => ({ kind: "shipping_option" as const, label })),
    ],
  }
}

/** Every record the plan names, one log line each, and what it leaves alone. */
export function logDemoPlan(plan: DemoRemovalPlan): void {
  const lines = describeDemoPlan(plan)
  for (const line of lines) {
    logger.info({ event: "demo.would_remove", ...line })
  }
  for (const skipped of plan.skipped) {
    logger.warn({ event: "demo.skipped", ...skipped }, "not the demo seed's: kept")
  }
  logger.info(
    { event: "demo.plan", records: lines.length, skipped: plan.skipped.length },
    "demo:remove plan"
  )
}

/**
 * Removes what the plan names, never more. Kept on purpose: the "Demo
 * storefront" publishable key (the storefront's local setup uses it), the
 * warehouse itself, the storefront frame's texts (the shop's to edit).
 * Orders first: their reservations hold the demo products' stock.
 */
export async function applyDemoRemoval(
  container: MedusaContainer,
  plan: DemoRemovalPlan
): Promise<DemoRemovalSummary> {
  const { orders, invoices } = await removeDemoOrders(container, plan.orders)
  const products = await removeDemoProducts(container, plan.products)
  const categories = await removeDemoCategories(container, plan.categories)
  const shippingOptions = await removeDemoShippingOptions(container, plan.shippingOptions)
  const warehouseAddresses = await clearDemoWarehouseAddresses(container, plan.warehouses)
  const staff = await removeE2eStaff(container, plan.e2eStaff)
  const importChecks = await removeLeftoverImportChecks(
    container,
    plan.importChecks,
    new Set(staff.failed)
  )
  const summary: DemoRemovalSummary = {
    orders,
    invoices,
    products: products.removed,
    productsKept: products.kept,
    categories: categories.removed,
    categoriesKept: [...plan.categoriesKept, ...categories.kept],
    shippingOptions,
    shippingOptionsKeptForCheckout: plan.shippingOptionsKeptForCheckout,
    warehouseAddresses,
    e2eStaff: staff.removed.length,
    e2eStaffKept: staff.failed.length,
    importChecks,
    skipped: plan.skipped.length,
  }
  if (plan.shippingOptionsKeptForCheckout > 0) {
    logger.warn(
      { event: "demo.shipping_kept", count: plan.shippingOptionsKeptForCheckout },
      "demo shipping options kept: the shop has no other way to ship yet"
    )
  }
  logger.info({ event: "demo.removed", ...summary }, "demo data removed")
  return summary
}

/** Plans and removes at once: a developer's machine (`demo:remove`). Safe to run again. */
export async function removeDemo(container: MedusaContainer): Promise<DemoRemovalSummary> {
  const plan = await planDemoRemoval(container)
  logDemoPlan(plan)
  return applyDemoRemoval(container, plan)
}
