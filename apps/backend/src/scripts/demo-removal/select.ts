import {
  DEMO_LOCATION_ADDRESS,
  DEMO_ORDER_ADDRESS_1,
  DEMO_ORDER_METADATA,
  DEMO_SHIPPING_OPTIONS,
  MANUAL_FULFILLMENT_PROVIDER_ID,
} from "../seed/data"

/**
 * What `demo:remove` takes out of a development database, decided from
 * rows read beforehand: pure, so the choices are tested apart from the
 * workflows that remove them.
 */

/** The staff the panel's e2e setup makes (apps/panel/e2e/support/admin.ts). */
export const E2E_STAFF_EMAIL = /^e2e-\d{13}-[0-9a-f]{6}@example\.com$/

export interface OrderRow {
  id: string
  email?: string | null
  metadata?: Record<string, unknown> | null
  shipping_address?: { address_1?: string | null } | null
}

/**
 * A demo order: marked so (seed:demo-orders from 2026-11-02), or older,
 * sent to the seed's made-up street with no e-mail (a shopper's order
 * always has one).
 */
export function isDemoOrder(order: OrderRow): boolean {
  const marked = Object.entries(DEMO_ORDER_METADATA).every(
    ([key, value]) => order.metadata?.[key] === value
  )
  return (
    marked || (order.shipping_address?.address_1 === DEMO_ORDER_ADDRESS_1 && !order.email?.trim())
  )
}

export interface ShippingOptionRow {
  id: string
  name: string
  provider_id?: string | null
  type?: { code?: string | null } | null
  rules?: ({ attribute: string; value: unknown } | null)[] | null
}

const isReturnOption = (option: ShippingOptionRow) =>
  (option.rules ?? []).some(
    (rule) => rule?.attribute === "is_return" && String(rule.value) === "true"
  )

/** One of the seed's two flat-rate options, by name, code and the manual provider. */
export function isDemoShippingOption(option: ShippingOptionRow): boolean {
  return DEMO_SHIPPING_OPTIONS.some(
    (demo) =>
      demo.name === option.name &&
      demo.code === option.type?.code &&
      option.provider_id === MANUAL_FULFILLMENT_PROVIDER_ID
  )
}

/**
 * The demo options to remove: only when the shop ships some other way,
 * else checkout would offer nothing (they stay, and the run says so).
 */
export function demoShippingOptionsToRemove(options: ShippingOptionRow[]): {
  remove: string[]
  keptForCheckout: string[]
} {
  const demo = options.filter(isDemoShippingOption)
  const others = options.filter(
    (option) => !isDemoShippingOption(option) && !isReturnOption(option)
  )
  const ids = demo.map((option) => option.id)
  return others.length > 0
    ? { remove: ids, keptForCheckout: [] }
    : { remove: [], keptForCheckout: ids }
}

export interface LocationAddressRow {
  address_1?: string | null
  phone?: string | null
  postal_code?: string | null
}

/** The seed's made-up warehouse address, unchanged by the shop. */
export function isDemoWarehouseAddress(address: LocationAddressRow | null | undefined): boolean {
  return (
    !!address &&
    address.address_1 === DEMO_LOCATION_ADDRESS.address_1 &&
    address.phone === DEMO_LOCATION_ADDRESS.phone &&
    address.postal_code === DEMO_LOCATION_ADDRESS.postal_code
  )
}

export interface CategoryRow {
  id: string
  handle: string
  products?: unknown[] | null
  category_children?: unknown[] | null
}

/** A demo category goes once nothing of the shop's is in or under it. */
export function isEmptyCategory(category: CategoryRow): boolean {
  return (category.products ?? []).length === 0 && (category.category_children ?? []).length === 0
}

export interface ImportJobRow {
  id: string
  type: string
  status: string
  input?: unknown
  requested_by?: string | null
}

const FINISHED = new Set(["succeeded", "failed", "cancelled"])

/**
 * A sheet check an e2e run left (smoke.e2e.ts checks a sheet without
 * writing it): a finished `check` of the product import, asked for by a
 * staff member who is gone (e2e staff are removed after each run) or is
 * being removed now. A check writes nothing; only its record goes.
 */
export function isLeftoverImportCheck(
  job: ImportJobRow,
  liveUserIds: ReadonlySet<string>,
  removedUserIds: ReadonlySet<string>
): boolean {
  const mode = (job.input as { mode?: unknown } | null | undefined)?.mode
  const by = job.requested_by ?? ""
  return (
    job.type === "catalog.import" &&
    mode === "check" &&
    FINISHED.has(job.status) &&
    by.startsWith("user_") &&
    (removedUserIds.has(by) || !liveUserIds.has(by))
  )
}
