import type { RouteRule } from "./route-table"

/**
 * The AI platform credits (adr/0085 §2, §5, "Güvenlik"): the owner's
 * alone, every route. The providers' keys, the routing, the packs and the
 * platform's values; a shop's wallet and its corrections; the top-up
 * requests. Every change is proved again (a key, money or what a shop
 * pays), and each one's audit row carries what changed, never a key.
 */
const OWNER = ["owner"] as const
const TENANT = { type: "tenant", param: "id" } as const
const PROVIDER = { type: "ai_provider", param: "service" } as const
const ORDER = { type: "ai_credit_order", param: "id" } as const
const SETTINGS = { type: "ai_credit_setting" } as const
const WALLET = "/admin/cp/tenants/:id/ai-credits"

export const AI_ROUTES: RouteRule[] = [
  { method: "GET", path: "/admin/cp/ai/settings", access: OWNER, resource: SETTINGS },
  {
    method: "POST",
    path: "/admin/cp/ai/settings",
    access: OWNER,
    stepUp: true,
    resource: SETTINGS,
  },
  { method: "GET", path: "/admin/cp/ai/providers", access: OWNER },
  {
    method: "POST",
    path: "/admin/cp/ai/providers/:service",
    access: OWNER,
    stepUp: true,
    resource: PROVIDER,
  },
  {
    method: "DELETE",
    path: "/admin/cp/ai/providers/:service",
    access: OWNER,
    stepUp: true,
    resource: PROVIDER,
  },
  { method: "GET", path: WALLET, access: OWNER, resource: TENANT },
  { method: "POST", path: `${WALLET}/adjust`, access: OWNER, stepUp: true, resource: TENANT },
  { method: "POST", path: `${WALLET}/daily-cap`, access: OWNER, stepUp: true, resource: TENANT },
  { method: "GET", path: "/admin/cp/ai/orders", access: OWNER },
  {
    method: "POST",
    path: "/admin/cp/ai/orders/:id/paid",
    access: OWNER,
    stepUp: true,
    resource: ORDER,
  },
  {
    method: "POST",
    path: "/admin/cp/ai/orders/:id/cancel",
    access: OWNER,
    stepUp: true,
    resource: ORDER,
  },
]
