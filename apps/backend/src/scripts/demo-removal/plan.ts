/**
 * What `demo:remove` is about to take, read whole before anything goes
 * (`planDemoRemoval`), and what a run outside development does with it:
 * pure, so the rules are tested apart from the database.
 */

export interface PlannedRecord {
  id: string
  /** What a person reads it by: a handle, a name; never personal data. */
  label: string
}

export interface DemoRemovalPlan {
  /** Each order with its line items (their reservations go with it). */
  orders: { id: string; line_item_ids: string[] }[]
  products: PlannedRecord[]
  /** Removed once empty after the products: nothing of the shop's is in or under them. */
  categories: PlannedRecord[]
  /** Demo categories the shop put its own products or categories in: they stay. */
  categoriesKept: string[]
  shippingOptions: PlannedRecord[]
  /** Demo options kept: the shop has no other way to ship yet. */
  shippingOptionsKeptForCheckout: number
  /** Warehouses whose address is the seed's made-up one: the address is cleared. */
  warehouses: PlannedRecord[]
  /** Staff an e2e run left (user ids; their addresses are made up, and stay out of the log). */
  e2eStaff: PlannedRecord[]
  importChecks: (PlannedRecord & { requested_by: string })[]
  /** A demo handle or name on a record the seed did not make, or made and the shop changed. */
  skipped: { kind: "product" | "category" | "shipping_option"; label: string }[]
}

export type PlannedKind =
  | "order"
  | "product"
  | "category"
  | "shipping_option"
  | "warehouse_address"
  | "e2e_staff"
  | "import_check"

/** The plan as one line per record, in the order the run removes them. */
export function describeDemoPlan(
  plan: DemoRemovalPlan
): { kind: PlannedKind; id: string; label: string }[] {
  const lines = (kind: PlannedKind, records: readonly PlannedRecord[]) =>
    records.map((record) => ({ kind, id: record.id, label: record.label }))
  return [
    ...lines(
      "order",
      plan.orders.map((order) => ({
        id: order.id,
        label: `${String(order.line_item_ids.length)} line items`,
      }))
    ),
    ...lines("product", plan.products),
    ...lines("category", plan.categories),
    ...lines("shipping_option", plan.shippingOptions),
    ...lines("warehouse_address", plan.warehouses),
    ...lines("e2e_staff", plan.e2eStaff),
    ...lines("import_check", plan.importChecks),
  ]
}

export const ALLOW_FLAG = "allow-non-local"
export const CONFIRM_FLAG = "confirm"

/**
 * What a run does. On a developer's machine it removes. Elsewhere (a demo
 * tenant handed over to its shop) it needs `allow-non-local` to read at
 * all, then lists what it would remove and stops, unless `confirm` comes
 * with it: a person has read the list first.
 */
export function demoRemovalMode(
  local: boolean,
  args: readonly string[]
): "remove" | "list_only" | "refuse" {
  if (local) {
    return "remove"
  }
  if (!args.includes(ALLOW_FLAG)) {
    return "refuse"
  }
  return args.includes(CONFIRM_FLAG) ? "remove" : "list_only"
}
