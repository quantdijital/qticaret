import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { AuditedResource, GraphQuery, Resolver, Snapshot } from "../types"
import { ID } from "../types"

/**
 * Warehouses and the store's default one (F3.7, adr/0011): name and
 * address before and after, through the panel's routes or Medusa's own.
 * The default warehouse decides where every stock entry goes, so its
 * change is a setting. The warehouse phone is a business line, but it is
 * written as changed only, like other phone numbers.
 */

const query = (scope: Resolver) => scope.resolve(ContainerRegistrationKeys.QUERY) as GraphQuery

const ADDRESS_FIELDS = [
  "address_1",
  "address_2",
  "city",
  "province",
  "postal_code",
  "country_code",
  "phone",
] as const

interface LocationRow {
  name?: string
  address?: Record<string, unknown> | null
}

async function locationSnapshot(scope: Resolver, filters: Record<string, unknown>) {
  const { data } = await query(scope).graph({
    entity: "stock_location",
    fields: ["name", ...ADDRESS_FIELDS.map((field) => `address.${field}`)],
    filters,
  })
  const row = data[0] as LocationRow | undefined
  if (!row) {
    return {}
  }
  return {
    name: row.name ?? null,
    ...Object.fromEntries(ADDRESS_FIELDS.map((field) => [field, row.address?.[field] ?? null])),
  } satisfies Snapshot
}

// A new warehouse is found by the name in its body
async function byName(scope: Resolver, body: unknown): Promise<Snapshot> {
  const { name } = (body ?? {}) as { name?: unknown }
  return typeof name === "string" && name.trim() !== ""
    ? locationSnapshot(scope, { name: name.trim() })
    : {}
}

async function storeDefault(scope: Resolver): Promise<Snapshot> {
  const { data } = await query(scope).graph({
    entity: "store",
    fields: ["default_location_id"],
    filters: {},
  })
  return {
    default_location_id:
      (data[0] as { default_location_id?: string | null } | undefined)?.default_location_id ?? null,
  }
}

async function watchOf(scope: Resolver, id: string): Promise<Snapshot> {
  const { data } = await query(scope).graph({
    entity: "stock_watch",
    fields: ["threshold"],
    filters: { inventory_item_id: id },
  })
  return { threshold: (data[0] as { threshold?: number | null } | undefined)?.threshold ?? null }
}

// Each variant's stock tracking, on or off, by its id
async function trackingOf(scope: Resolver, productId: string): Promise<Snapshot> {
  const { data } = await query(scope).graph({
    entity: "product_variant",
    fields: ["id", "manage_inventory"],
    filters: { product_id: productId },
  })
  return Object.fromEntries(
    (data as { id: string; manage_inventory?: boolean | null }[]).map((variant) => [
      `manage_inventory:${variant.id}`,
      variant.manage_inventory === true,
    ])
  )
}

const SENSITIVE = ["phone"] as const

const byId = (method: "POST" | "DELETE", path: string): AuditedResource => ({
  method,
  route: `${method} ${path.replace(`(?<id>${ID})`, ":id")}`,
  pattern: new RegExp(`^${path}$`, "i"),
  resourceType: "stock_location",
  resourceId: (params) => params["id"] ?? null,
  snapshot: ({ scope, params }) => locationSnapshot(scope, { id: params["id"] ?? "" }),
  sensitive: SENSITIVE,
})

export const STOCK_RESOURCES: readonly AuditedResource[] = [
  ...["/admin/warehouses", "/admin/stock-locations"].map((path): AuditedResource => ({
    method: "POST",
    route: `POST ${path}`,
    pattern: new RegExp(`^${path}$`, "i"),
    resourceType: "stock_location",
    resourceId: () => null,
    snapshot: ({ scope, body }) => byName(scope, body),
    sensitive: SENSITIVE,
  })),
  byId("POST", `/admin/warehouses/(?<id>${ID})`),
  byId("POST", `/admin/stock-locations/(?<id>${ID})`),
  byId("DELETE", `/admin/stock-locations/(?<id>${ID})`),
  // An item's own low-stock threshold decides when the shop is alerted
  {
    method: "POST",
    route: "POST /admin/stock-items/:id/watch",
    pattern: new RegExp(`^/admin/stock-items/(?<id>${ID})/watch$`, "i"),
    resourceType: "inventory_item",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => watchOf(scope, params["id"] ?? ""),
  },
  // A variant's stock counted or not decides whether it can sell out
  {
    method: "POST",
    route: "POST /admin/products/:id/stock-tracking",
    pattern: new RegExp(`^/admin/products/(?<id>${ID})/stock-tracking$`, "i"),
    resourceType: "product_stock_tracking",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => trackingOf(scope, params["id"] ?? ""),
  },
  ...[`/admin/warehouses/(?<id>${ID})/default`, `/admin/stores/(?<id>${ID})`].map(
    (path): AuditedResource => ({
      method: "POST",
      route: `POST ${path.replace(`(?<id>${ID})`, ":id")}`,
      pattern: new RegExp(`^${path}$`, "i"),
      resourceType: "store",
      resourceId: (params) => params["id"] ?? null,
      snapshot: ({ scope }) => storeDefault(scope),
    })
  ),
]
