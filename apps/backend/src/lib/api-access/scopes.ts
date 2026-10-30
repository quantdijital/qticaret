/**
 * What an API key may reach (F11.6, adr/0039 §6). Medusa's secret keys
 * open all of /admin by default; ours open only the routes their scopes
 * list here, every other route stays closed to them.
 */

export const API_SCOPES = [
  "orders:read",
  "catalog:read",
  "stock:write",
  "webhooks:manage",
  // F8 (adr/0034 §9): an invoicing program (BirFatura and the like) writes invoices back
  "invoices:read",
  "invoices:write",
] as const
export type ApiScope = (typeof API_SCOPES)[number]

export interface ScopedRoute {
  scope: ApiScope
  method: "GET" | "POST" | "DELETE"
  /** Medusa's form: `:name` is one path segment. */
  path: string
  /** For the OpenAPI document. */
  summary: string
}

export const SCOPED_ROUTES: readonly ScopedRoute[] = [
  { scope: "orders:read", method: "GET", path: "/admin/orders", summary: "Siparişleri listele" },
  { scope: "orders:read", method: "GET", path: "/admin/orders/:id", summary: "Sipariş ayrıntısı" },
  { scope: "catalog:read", method: "GET", path: "/admin/products", summary: "Ürünleri listele" },
  { scope: "catalog:read", method: "GET", path: "/admin/products/:id", summary: "Ürün ayrıntısı" },
  {
    scope: "catalog:read",
    method: "GET",
    path: "/admin/product-categories",
    summary: "Kategorileri listele",
  },
  {
    scope: "catalog:read",
    method: "GET",
    path: "/admin/inventory-items",
    summary: "Stok kalemlerini listele",
  },
  {
    scope: "catalog:read",
    method: "GET",
    path: "/admin/inventory-items/:id",
    summary: "Stok kalemi ayrıntısı",
  },
  {
    scope: "catalog:read",
    method: "GET",
    path: "/admin/inventory-items/:id/location-levels",
    summary: "Bir stok kaleminin depolardaki adetleri",
  },
  {
    scope: "catalog:read",
    method: "GET",
    path: "/admin/stock-locations",
    summary: "Depoları listele",
  },
  {
    scope: "stock:write",
    method: "POST",
    path: "/admin/inventory-items/:id/location-levels/:location_id",
    summary: "Bir depodaki stok adedini güncelle",
  },
  {
    scope: "stock:write",
    method: "POST",
    path: "/admin/inventory-items/location-levels/batch",
    summary: "Depolardaki stok adetlerini toplu güncelle",
  },
  {
    scope: "webhooks:manage",
    method: "GET",
    path: "/admin/webhooks",
    summary: "Webhook aboneliklerini listele",
  },
  {
    scope: "webhooks:manage",
    method: "POST",
    path: "/admin/webhooks",
    summary: "Webhook aboneliği oluştur",
  },
  {
    scope: "webhooks:manage",
    method: "GET",
    path: "/admin/webhooks/:id",
    summary: "Webhook aboneliği ayrıntısı",
  },
  {
    scope: "webhooks:manage",
    method: "POST",
    path: "/admin/webhooks/:id",
    summary: "Webhook aboneliğini güncelle",
  },
  {
    scope: "webhooks:manage",
    method: "DELETE",
    path: "/admin/webhooks/:id",
    summary: "Webhook aboneliğini sil",
  },
  { scope: "invoices:read", method: "GET", path: "/admin/invoices", summary: "Faturaları listele" },
  { scope: "invoices:read", method: "GET", path: "/admin/invoices/:id", summary: "Fatura kaydı" },
  {
    scope: "invoices:read",
    method: "GET",
    path: "/admin/invoices/:id/draft",
    summary: "Kesilecek faturanın içeriği (alıcı dahil)",
  },
  {
    scope: "invoices:write",
    method: "POST",
    path: "/admin/invoices/:id/issued",
    summary: "Kesilen faturanın numarasını bildir",
  },
  {
    scope: "invoices:write",
    method: "POST",
    path: "/admin/invoices/:id/pdf",
    summary: "Kesilen faturanın PDF'ini yükle",
  },
]

// A path segment as Express decodes it: never a slash, never empty
const SEGMENT = "[^/]+"

const patternOf = (path: string) =>
  new RegExp(
    `^${path
      .split("/")
      .map((part) => (part.startsWith(":") ? SEGMENT : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .join("/")}/?$`
  )

const MATCHERS = SCOPED_ROUTES.map((route) => ({ route, pattern: patternOf(route.path) }))

/**
 * The scope a request needs, or null when the route is closed to keys.
 * The path is the one Express routes by (no query); a fixed segment wins
 * over a parameter (`/location-levels/batch` is the batch, not an id).
 */
export function scopeOf(method: string, path: string): ApiScope | null {
  const matches = MATCHERS.filter(
    ({ route, pattern }) => route.method === method.toUpperCase() && pattern.test(path)
  )
  const fixed = (route: ScopedRoute) =>
    route.path.split("/").filter((part) => !part.startsWith(":")).length
  matches.sort((a, b) => fixed(b.route) - fixed(a.route))
  return matches[0]?.route.scope ?? null
}
