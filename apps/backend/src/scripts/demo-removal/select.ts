import {
  DEMO_CATEGORIES,
  DEMO_LOCATION_ADDRESS,
  DEMO_METADATA,
  DEMO_ORDER_ADDRESS_1,
  DEMO_PRODUCTS,
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

type Metadata = Record<string, unknown> | null | undefined

/** The seed's mark (`DEMO_METADATA`). */
export const hasDemoMark = (metadata: Metadata): boolean =>
  Object.entries(DEMO_METADATA).every(([key, value]) => metadata?.[key] === value)

/**
 * A record the seed made: its mark, or, made before the mark (2026-11-03),
 * no metadata at all and the seed's own name as written. A handle or a
 * name alone is never enough: a shop's own record may share it.
 */
export const isSeeded = (metadata: Metadata, name: string, seedName: string | undefined): boolean =>
  seedName !== undefined &&
  (hasDemoMark(metadata) || ((metadata === null || metadata === undefined) && name === seedName))

/**
 * A demo order: marked so (seed:demo-orders from 2026-11-02), or older,
 * sent to the seed's made-up street with no e-mail (a shopper's order
 * always has one).
 */
export function isDemoOrder(order: OrderRow): boolean {
  return (
    hasDemoMark(order.metadata) ||
    (order.shipping_address?.address_1 === DEMO_ORDER_ADDRESS_1 && !order.email?.trim())
  )
}

export interface ProductRow {
  id: string
  handle: string
  title: string
  metadata?: Metadata
}

/** One of the seed's products: its handle, and its mark or its unchanged title with no metadata. */
export const isDemoProduct = (product: ProductRow): boolean =>
  isSeeded(
    product.metadata,
    product.title,
    DEMO_PRODUCTS.find((demo) => demo.handle === product.handle)?.title
  )

/** A product with the stock its variants draw on (Query's variant to inventory item link). */
export interface ProductStockRow extends ProductRow {
  variants?:
    ({ inventory_items?: ({ inventory_item_id?: string | null } | null)[] | null } | null)[] | null
}

export interface ReservationRow {
  id: string
  inventory_item_id: string
}

/** A seed product a shopper's order still holds, with the reservations to release. */
export interface OrderedDemoProduct {
  id: string
  label: string
  reservation_ids: string[]
}

/**
 * The seed products `products-with-orders` takes (local only): the same
 * ones the plain run plans (`isDemoProduct`): a demo handle with the
 * seed's mark, or, seeded before the mark, no metadata and the seed's
 * title as written. A database seeded before 2026-11-03 has only the
 * latter, so the mark alone would take none of them. A handle alone is
 * never enough. Each with the reservations on its stock.
 */
export function orderedDemoProducts(
  products: readonly ProductStockRow[],
  reservations: readonly ReservationRow[]
): OrderedDemoProduct[] {
  return products.filter(isDemoProduct).map((product) => {
    const items = new Set(
      (product.variants ?? []).flatMap((variant) =>
        (variant?.inventory_items ?? []).flatMap((link) => link?.inventory_item_id ?? [])
      )
    )
    return {
      id: product.id,
      label: product.handle,
      reservation_ids: reservations
        .filter((reservation) => items.has(reservation.inventory_item_id))
        .map((reservation) => reservation.id),
    }
  })
}

export interface ShippingOptionRow {
  id: string
  name: string
  provider_id?: string | null
  metadata?: Metadata
  type?: { code?: string | null } | null
  rules?: ({ attribute: string; value: unknown } | null)[] | null
}

const isReturnOption = (option: ShippingOptionRow) =>
  (option.rules ?? []).some(
    (rule) => rule?.attribute === "is_return" && String(rule.value) === "true"
  )

/** Named, coded and sent like one of the seed's two flat-rate options: maybe the shop's own. */
export const looksLikeDemoShippingOption = (option: ShippingOptionRow): boolean =>
  DEMO_SHIPPING_OPTIONS.some(
    (demo) =>
      demo.name === option.name &&
      demo.code === option.type?.code &&
      option.provider_id === MANUAL_FULFILLMENT_PROVIDER_ID
  )

/**
 * One of the seed's two flat-rate options: it looks like one, and is
 * marked or (made before the mark) has no metadata.
 */
export const isDemoShippingOption = (option: ShippingOptionRow): boolean =>
  looksLikeDemoShippingOption(option) &&
  (hasDemoMark(option.metadata) || option.metadata === null || option.metadata === undefined)

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
  name?: string
  metadata?: Metadata
  products?: ({ id: string } | null)[] | null
  category_children?: unknown[] | null
}

/** One of the seed's categories: its handle, and its mark or its unchanged name with no metadata. */
export const isDemoCategory = (category: CategoryRow): boolean =>
  isSeeded(
    category.metadata,
    category.name ?? "",
    DEMO_CATEGORIES.find((demo) => demo.handle === category.handle)?.name
  )

/**
 * A demo category goes once nothing of the shop's is in or under it:
 * after the demo products that are going (`going`), if given.
 */
export function isEmptyCategory(
  category: CategoryRow,
  going: ReadonlySet<string> = new Set()
): boolean {
  return (
    (category.products ?? []).every((product) => !product || going.has(product.id)) &&
    (category.category_children ?? []).length === 0
  )
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
