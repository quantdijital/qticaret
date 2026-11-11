import type { RouteRule } from "./route-table"

/**
 * A shop's setup (Ek C10, adr/0061 §3.5 "operator: mağaza açma, kurulum"):
 * the owner and the operator. Reading the runs asks nothing more; every
 * start asks a fresh proof, because each acts outside the control plane:
 * a setup makes a database and a process, stopping takes a shop down,
 * starting brings one up, the invitation opens the shop's owner
 * account, and the sector pack writes into the shop's catalog and
 * settings (C12). Recorded against the shop, so its activity shows them.
 */
const SHOPS = ["owner", "operator"] as const
const TENANT = { type: "tenant", param: "id" } as const
const BASE = "/admin/cp/tenants/:id/provisioning"

export const PROVISIONING_ROUTES: RouteRule[] = [
  { method: "GET", path: BASE, access: SHOPS, resource: TENANT },
  { method: "GET", path: `${BASE}/runs/:run_id`, access: SHOPS, resource: TENANT },
  // C12: "/apply-pack" applies the shop's sector pack again (`tenant:apply-pack`)
  ...["", "/stop", "/start", "/invite", "/apply-pack"].map((action): RouteRule => ({
    method: "POST",
    path: `${BASE}${action}`,
    access: SHOPS,
    stepUp: true,
    resource: TENANT,
  })),
]
