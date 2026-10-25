/**
 * Audited resources (adr/0011): routes whose changes are summarised before
 * and after, field by field. Every phase that adds a sensitive route adds
 * its resource here (code-reviewer checklist). Other admin mutations get the
 * names of the body fields only.
 */

export interface GraphQuery {
  graph: (config: {
    entity: string
    fields: string[]
    filters: Record<string, unknown>
  }) => Promise<{ data: unknown[] }>
}

export type Snapshot = Record<string, unknown>

export interface AuditedResource {
  method: string
  /** The route pattern written as the action (`POST /admin/products/:id`). */
  route: string
  pattern: RegExp
  resourceType: string
  resourceId: (params: Record<string, string>) => string
  snapshot: (query: GraphQuery, params: Record<string, string>) => Promise<Snapshot>
  /** Fields whose values are never written: only "changed" and the last 4 characters. */
  sensitive?: readonly string[]
}

// Medusa IDs: a prefix and a ULID (`prod_01J...`); "batch" and other words are not IDs
const ID = "[a-z]+_[0-9A-Za-z]+"

interface PriceRow {
  id?: string | null
  amount?: unknown
  currency_code?: string | null
}

// One key per price: `<prefix>price:<id>` → "1250 try"
function prices(prefix: string, rows: readonly (PriceRow | null)[] | null | undefined): Snapshot {
  const snapshot: Snapshot = {}
  for (const row of rows ?? []) {
    if (row?.id) {
      snapshot[`${prefix}price:${row.id}`] =
        `${String(row.amount)} ${row.currency_code ?? ""}`.trim()
    }
  }
  return snapshot
}

const PRICE_FIELDS = ["prices.id", "prices.amount", "prices.currency_code"]

async function productPrices(query: GraphQuery, params: Record<string, string>): Promise<Snapshot> {
  const { data } = await query.graph({
    entity: "product",
    fields: ["variants.id", ...PRICE_FIELDS.map((field) => `variants.${field}`)],
    filters: { id: params["id"] },
  })
  const product = data[0] as
    { variants?: ({ id: string; prices?: PriceRow[] } | null)[] } | undefined
  return Object.assign(
    {},
    ...(product?.variants ?? []).map((variant) =>
      variant ? prices(`variant:${variant.id}:`, variant.prices) : {}
    )
  ) as Snapshot
}

async function ownPrices(
  entity: string,
  id: string | undefined,
  query: GraphQuery
): Promise<Snapshot> {
  const { data } = await query.graph({ entity, fields: PRICE_FIELDS, filters: { id } })
  return prices("", (data[0] as { prices?: PriceRow[] } | undefined)?.prices)
}

export const AUDITED_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/products/:id",
    pattern: new RegExp(`^/admin/products/(?<id>${ID})$`, "i"),
    resourceType: "product",
    resourceId: (params) => params["id"] ?? "",
    snapshot: productPrices,
  },
  {
    method: "POST",
    route: "POST /admin/products/:id/variants/batch",
    pattern: new RegExp(`^/admin/products/(?<id>${ID})/variants/batch$`, "i"),
    resourceType: "product",
    resourceId: (params) => params["id"] ?? "",
    snapshot: productPrices,
  },
  {
    method: "POST",
    route: "POST /admin/products/:id/variants/:variant_id",
    pattern: new RegExp(`^/admin/products/(?<id>${ID})/variants/(?<variant_id>${ID})$`, "i"),
    resourceType: "product_variant",
    resourceId: (params) => params["variant_id"] ?? "",
    snapshot: (query, params) => ownPrices("product_variant", params["variant_id"], query),
  },
  {
    method: "POST",
    route: "POST /admin/price-lists/:id/prices/batch",
    pattern: new RegExp(`^/admin/price-lists/(?<id>${ID})/prices/batch$`, "i"),
    resourceType: "price_list",
    resourceId: (params) => params["id"] ?? "",
    snapshot: (query, params) => ownPrices("price_list", params["id"], query),
  },
]

export interface ResourceMatch {
  resource: AuditedResource
  params: Record<string, string>
}

/** `path` keeps its case; the patterns match without regard to it, as Express does. */
export function matchAuditedResource(
  method: string,
  path: string,
  resources: readonly AuditedResource[] = AUDITED_RESOURCES
): ResourceMatch | null {
  for (const resource of resources) {
    const match = resource.method === method ? resource.pattern.exec(path) : null
    if (match) {
      return { resource, params: { ...match.groups } }
    }
  }
  return null
}

const ID_SEGMENT = new RegExp(`^${ID}$`)

/**
 * For routes not in the registry: the path with IDs as `:id`, its area and
 * first ID. `path` keeps its case (IDs are case-sensitive); the fixed
 * segments are written in lower case, as Express matched them.
 */
export function describeRoute(method: string, path: string) {
  const segments = path.split("/").filter(Boolean)
  const resourceId = segments.find((segment) => ID_SEGMENT.test(segment)) ?? null
  const fixed = segments.map((segment) =>
    ID_SEGMENT.test(segment) ? ":id" : segment.toLowerCase()
  )
  return {
    action: `${method} /${fixed.join("/")}`,
    resourceType: fixed[1] ?? null,
    resourceId,
  }
}
