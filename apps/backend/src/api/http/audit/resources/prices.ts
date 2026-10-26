import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { AuditedResource, GraphQuery, Resolver, Snapshot } from "../types"
import { ID } from "../types"

/**
 * Price-bearing routes (adr/0011, F2 KK): every price a request could add,
 * change or remove, before and after. One key per price, its value the
 * amount, currency and quantity bounds: `variant:<id>:price:<id>` →
 * "1250 try". Price lists also show title, status, dates, type and who
 * they are for (`rule:customer.groups.id`), which decide the price a
 * customer pays. A variant also shows whether it tracks stock
 * and sells past it (F3.8): `variant:<id>:allow_backorder` → true.
 */

interface PriceRow {
  id?: string | null
  amount?: unknown
  currency_code?: string | null
  min_quantity?: number | string | null
  max_quantity?: number | string | null
}

const PRICE_FIELDS = ["id", "amount", "currency_code", "min_quantity", "max_quantity"]
// A batch names at most this many products; more are summarised by count
const MAX_BATCH_PRODUCTS = 100

const graph = (scope: Resolver) => scope.resolve(ContainerRegistrationKeys.QUERY) as GraphQuery

function priceText(row: PriceRow): string {
  const bounds =
    row.min_quantity || row.max_quantity
      ? ` [${String(row.min_quantity ?? "")}-${String(row.max_quantity ?? "")}]`
      : ""
  return `${String(row.amount)} ${row.currency_code ?? ""}${bounds}`.trim()
}

function prices(prefix: string, rows: readonly (PriceRow | null)[] | null | undefined): Snapshot {
  const snapshot: Snapshot = {}
  for (const row of rows ?? []) {
    if (row?.id) {
      snapshot[`${prefix}price:${row.id}`] = priceText(row)
    }
  }
  return snapshot
}

interface VariantRow {
  id: string
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  prices?: PriceRow[]
}

interface ProductRow {
  id: string
  variants?: (VariantRow | null)[]
}

const STOCK_FIELDS = ["manage_inventory", "allow_backorder"] as const

const variantSnapshot = (prefix: string, variant: Omit<VariantRow, "id">): Snapshot => ({
  ...prices(prefix, variant.prices),
  ...Object.fromEntries(STOCK_FIELDS.map((field) => [`${prefix}${field}`, variant[field] ?? null])),
})

async function productPrices(scope: Resolver, ids: string[], keyByProduct: boolean) {
  if (ids.length === 0) {
    return {}
  }
  const { data } = await graph(scope).graph({
    entity: "product",
    fields: [
      "id",
      "variants.id",
      ...STOCK_FIELDS.map((field) => `variants.${field}`),
      ...PRICE_FIELDS.map((field) => `variants.prices.${field}`),
    ],
    filters: { id: ids },
  })
  const snapshot: Snapshot = {}
  for (const product of data as ProductRow[]) {
    for (const variant of product.variants ?? []) {
      if (variant) {
        const prefix = `${keyByProduct ? `product:${product.id}:` : ""}variant:${variant.id}:`
        Object.assign(snapshot, variantSnapshot(prefix, variant))
      }
    }
  }
  return snapshot
}

async function variantPrices(scope: Resolver, id: string | undefined): Promise<Snapshot> {
  const { data } = await graph(scope).graph({
    entity: "product_variant",
    fields: [...STOCK_FIELDS, ...PRICE_FIELDS.map((field) => `prices.${field}`)],
    filters: { id },
  })
  const variant = data[0] as Omit<VariantRow, "id"> | undefined
  return variant ? variantSnapshot("", variant) : {}
}

async function priceList(scope: Resolver, id: string | undefined): Promise<Snapshot> {
  const { data } = await graph(scope).graph({
    entity: "price_list",
    fields: [
      "title",
      "status",
      "starts_at",
      "ends_at",
      "type",
      "price_list_rules.attribute",
      "price_list_rules.value",
      ...PRICE_FIELDS.map((f) => `prices.${f}`),
    ],
    filters: { id },
  })
  const list = data[0] as
    | (Record<string, unknown> & {
        prices?: PriceRow[]
        price_list_rules?: ({ attribute?: string | null; value?: unknown } | null)[]
      })
    | undefined
  if (!list) {
    return {}
  }
  // Who the list is for (customer groups): one key per rule
  const { prices: rows, price_list_rules: rules, ...meta } = list
  const ruleKeys = Object.fromEntries(
    (rules ?? []).flatMap((rule) =>
      rule?.attribute ? [[`rule:${rule.attribute}`, ruleText(rule.value)]] : []
    )
  )
  return { ...meta, ...ruleKeys, ...prices("", rows) }
}

// Products a batch updates or deletes, from its body
function batchProductIds(body: unknown): string[] {
  const { update, delete: removed } = (body ?? {}) as { update?: unknown; delete?: unknown }
  const updated = Array.isArray(update)
    ? update.map((item) => (item as { id?: unknown } | null)?.id)
    : []
  const ids = [...updated, ...(Array.isArray(removed) ? (removed as unknown[]) : [])]
  return [...new Set(ids.filter((id): id is string => typeof id === "string"))].slice(
    0,
    MAX_BATCH_PRODUCTS
  )
}

const route = (method: string, path: string, pattern: string) => ({
  method,
  route: `${method} ${path}`,
  pattern: new RegExp(`^${pattern}$`, "i"),
})

const productId = (params: Record<string, string>) => params["id"] ?? null
const priceListId = productId

// A rule's values in a stable order: the same groups in another order are no change
const ruleText = (value: unknown): string =>
  JSON.stringify(
    Array.isArray(value) ? [...(value as unknown[])].map(String).sort() : (value ?? null)
  )

export const PRICE_RESOURCES: readonly AuditedResource[] = [
  {
    ...route("POST", "/admin/products/batch", "/admin/products/batch"),
    resourceType: "product",
    resourceId: () => null,
    snapshot: ({ scope, body }) => productPrices(scope, batchProductIds(body), true),
  },
  ...(["POST", "DELETE"] as const).map((method) => ({
    ...route(method, "/admin/products/:id", `/admin/products/(?<id>${ID})`),
    resourceType: "product",
    resourceId: productId,
    snapshot: ({ scope, params }: { scope: Resolver; params: Record<string, string> }) =>
      productPrices(scope, [params["id"] ?? ""], false),
  })),
  ...["variants", "variants/batch"].map((tail) => ({
    ...route("POST", `/admin/products/:id/${tail}`, `/admin/products/(?<id>${ID})/${tail}`),
    resourceType: "product",
    resourceId: productId,
    snapshot: ({ scope, params }: { scope: Resolver; params: Record<string, string> }) =>
      productPrices(scope, [params["id"] ?? ""], false),
  })),
  ...(["POST", "DELETE"] as const).map((method) => ({
    ...route(
      method,
      "/admin/products/:id/variants/:variant_id",
      `/admin/products/(?<id>${ID})/variants/(?<variant_id>${ID})`
    ),
    resourceType: "product_variant",
    resourceId: (params: Record<string, string>) => params["variant_id"] ?? null,
    snapshot: ({ scope, params }: { scope: Resolver; params: Record<string, string> }) =>
      variantPrices(scope, params["variant_id"]),
  })),
  ...[
    route("POST", "/admin/price-lists/:id", `/admin/price-lists/(?<id>${ID})`),
    route("DELETE", "/admin/price-lists/:id", `/admin/price-lists/(?<id>${ID})`),
    route(
      "POST",
      "/admin/price-lists/:id/prices/batch",
      `/admin/price-lists/(?<id>${ID})/prices/batch`
    ),
    route("POST", "/admin/price-lists/:id/products", `/admin/price-lists/(?<id>${ID})/products`),
    route("POST", "/admin/price-lists/:id/discount", `/admin/price-lists/(?<id>${ID})/discount`),
  ].map((entry) => ({
    ...entry,
    resourceType: "price_list",
    resourceId: priceListId,
    snapshot: ({ scope, params }: { scope: Resolver; params: Record<string, string> }) =>
      priceList(scope, params["id"]),
  })),
]
