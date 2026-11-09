/**
 * The panel's product list (adr/0022): the filters and orders Medusa's own
 * product list cannot do, worked out over light product rows read once.
 * Prices are Medusa amounts in lira; stock is what can be sold now
 * (stocked less reserved, over every location).
 */

export const PRODUCT_STATUSES = ["published", "draft", "proposed", "rejected"] as const
export const STOCK_FILTERS = ["in", "low", "out"] as const
export const MISSING_FILTERS = ["image", "price", "description", "seo"] as const
export const PRODUCT_KIND_FILTERS = ["physical", "digital", "service"] as const
export const PRODUCT_ORDERS = [
  "-updated_at",
  "updated_at",
  "-created_at",
  "created_at",
  "title",
  "-title",
  "price",
  "-price",
  "stock",
  "-stock",
] as const

export type StockFilter = (typeof STOCK_FILTERS)[number]
export type MissingFilter = (typeof MISSING_FILTERS)[number]
export type ProductKindFilter = (typeof PRODUCT_KIND_FILTERS)[number]
export type ProductOrder = (typeof PRODUCT_ORDERS)[number]

// The list's currency (one region until F19)
export const BOARD_CURRENCY = "try"

export interface BoardLevel {
  stocked_quantity?: number | string | null
  reserved_quantity?: number | string | null
}

export interface BoardVariant {
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  prices?: ({ amount?: number | string | null; currency_code?: string | null } | null)[] | null
  inventory_items?:
    | ({
        inventory_item_id?: string | null
        inventory?: { location_levels?: (BoardLevel | null)[] | null } | null
      } | null)[]
    | null
}

export interface BoardProduct {
  id: string
  title?: string | null
  created_at?: string | Date | null
  updated_at?: string | Date | null
  thumbnail?: string | null
  description?: string | null
  images?: ({ id: string } | null)[] | null
  variants?: (BoardVariant | null)[] | null
  product_extension?: { kind?: string | null } | null
}

/** What the rows are cut to and ordered by, besides what Medusa's own filters did. */
export interface ScanFilters {
  stock?: StockFilter | undefined
  missing?: MissingFilter | undefined
  kind?: ProductKindFilter | undefined
  order: ProductOrder
}

const variantsOf = (product: BoardProduct): BoardVariant[] =>
  (product.variants ?? []).filter((variant): variant is BoardVariant => Boolean(variant))

/** What a variant can sell now: stocked less reserved over its items' locations. */
export function variantAvailable(variant: BoardVariant): number {
  return (variant.inventory_items ?? []).reduce(
    (sum, item) =>
      sum +
      (item?.inventory?.location_levels ?? []).reduce(
        (each, level) =>
          each + Number(level?.stocked_quantity ?? 0) - Number(level?.reserved_quantity ?? 0),
        0
      ),
    0
  )
}

// A variant whose stock is counted: kept, and not sold past it
const isCounted = (variant: BoardVariant): boolean =>
  variant.manage_inventory === true && variant.allow_backorder !== true

/** The product's stock to sort by: its counted variants' sum; null when none is counted. */
export function productStock(product: BoardProduct): number | null {
  const counted = variantsOf(product).filter(isCounted)
  return counted.length === 0
    ? null
    : counted.reduce((sum, variant) => sum + variantAvailable(variant), 0)
}

/**
 * Where the product's stock stands: `out` when nothing of it can be
 * bought (every variant counted and at zero or below), `low` when some
 * counted variant is at or below its threshold (`thresholdOf` its first
 * item's), else `in`, a product nobody counts included.
 */
export function stockState(
  product: BoardProduct,
  thresholdOf: (inventoryItemId: string) => number
): StockFilter {
  const variants = variantsOf(product)
  const counted = variants.filter(isCounted)
  if (counted.length === 0) {
    return "in"
  }
  const sellable = variants.some((variant) => !isCounted(variant) || variantAvailable(variant) > 0)
  if (!sellable) {
    return "out"
  }
  const low = counted.some((variant) => {
    const itemId = variant.inventory_items?.find(Boolean)?.inventory_item_id
    const threshold = itemId ? thresholdOf(itemId) : 0
    return variantAvailable(variant) <= threshold
  })
  return low ? "low" : "in"
}

/** The lowest price in lira, or null without one. */
export function lowestPrice(product: BoardProduct, currency = BOARD_CURRENCY): number | null {
  const amounts = variantsOf(product).flatMap((variant) =>
    (variant.prices ?? []).flatMap((price) => {
      const amount = Number(price?.amount)
      return price?.currency_code === currency && Number.isFinite(amount) ? [amount] : []
    })
  )
  return amounts.length > 0 ? Math.min(...amounts) : null
}

/** What the product lacks, as the "eksik" quick filters ask it (SEO is asked of the advisor). */
export function isMissing(product: BoardProduct, missing: Exclude<MissingFilter, "seo">): boolean {
  switch (missing) {
    case "image":
      return !product.thumbnail && !(product.images ?? []).some(Boolean)
    case "price":
      // A variant without a price cannot be sold: one is enough to count
      return (
        variantsOf(product).length === 0 ||
        variantsOf(product).some(
          (variant) =>
            !(variant.prices ?? []).some((price) => price?.currency_code === BOARD_CURRENCY)
        )
      )
    case "description":
      return (product.description ?? "").trim() === ""
  }
}

const kindOf = (product: BoardProduct): string => product.product_extension?.kind ?? "physical"

const timeOf = (value: string | Date | null | undefined): number =>
  value ? new Date(value).getTime() : 0

// A product with no value sorts last whichever way, then the newest first
const byValue =
  (valueOf: (product: BoardProduct) => number | null, direction: 1 | -1) =>
  (a: BoardProduct, b: BoardProduct): number => {
    const left = valueOf(a)
    const right = valueOf(b)
    if (left === null || right === null) {
      return left === right ? 0 : left === null ? 1 : -1
    }
    return (left - right) * direction
  }

const collator = new Intl.Collator("tr", { sensitivity: "base", numeric: true })

/** How two rows compare for an order; ties keep the newest change first, then the id. */
export function compareFor(order: ProductOrder): (a: BoardProduct, b: BoardProduct) => number {
  const direction = order.startsWith("-") ? -1 : 1
  const key = order.replace(/^-/, "")
  const primary =
    key === "price"
      ? byValue((product) => lowestPrice(product), direction)
      : key === "stock"
        ? byValue(productStock, direction)
        : key === "title"
          ? (a: BoardProduct, b: BoardProduct) =>
              collator.compare(a.title ?? "", b.title ?? "") * direction
          : key === "created_at"
            ? (a: BoardProduct, b: BoardProduct) =>
                (timeOf(a.created_at) - timeOf(b.created_at)) * direction
            : (a: BoardProduct, b: BoardProduct) =>
                (timeOf(a.updated_at) - timeOf(b.updated_at)) * direction
  return (a, b) =>
    primary(a, b) || timeOf(b.updated_at) - timeOf(a.updated_at) || a.id.localeCompare(b.id)
}

/** The rows the scan's filters keep, in the order asked; the ids only. */
export function scanProducts(
  products: readonly BoardProduct[],
  filters: ScanFilters,
  thresholdOf: (inventoryItemId: string) => number
): string[] {
  const { stock, missing, kind } = filters
  return products
    .filter(
      (product) =>
        (!kind || kindOf(product) === kind) &&
        (!stock || stockState(product, thresholdOf) === stock) &&
        (!missing || missing === "seo" || isMissing(product, missing))
    )
    .sort(compareFor(filters.order))
    .map((product) => product.id)
}

/** Whether Medusa's own query can order these (its columns), so pages are read by it. */
export const isColumnOrder = (order: ProductOrder): boolean => !/^-?(price|stock)$/.test(order)

/** The categories a filter on one takes: it and every one below it. */
export function categoryAndBelow(
  categoryId: string,
  categories: readonly { id: string; parent_category_id?: string | null }[]
): string[] {
  const children = new Map<string, string[]>()
  for (const category of categories) {
    const parent = category.parent_category_id
    if (parent) {
      children.set(parent, [...(children.get(parent) ?? []), category.id])
    }
  }
  const found = new Set<string>([categoryId])
  const queue = [categoryId]
  while (queue.length > 0) {
    const next = queue.shift() ?? ""
    for (const child of children.get(next) ?? []) {
      if (!found.has(child)) {
        found.add(child)
        queue.push(child)
      }
    }
  }
  return [...found]
}
