import { CP_STAFF_ROLES } from "./roles"
import type { RouteRule } from "./route-table"

/**
 * Releases and the dashboard (adr/0061 F17.5, C18, Ek C18). Reading them
 * is everyone's: versions and counts, the dashboard's amounts and days the
 * payments list already shows every role. Releases are run by who runs
 * shops (owner, operator, as a shop's package): adding one, its note and a
 * shop's target, each proved again (a target is what F16.6's waves will
 * act on). A shop's target records against the shop, so its activity
 * shows it.
 */
const ALL = CP_STAFF_ROLES
const SHOPS = ["owner", "operator"] as const
const RELEASE = { type: "release", param: "id" } as const

export const FLEET_ROUTES: RouteRule[] = [
  { method: "GET", path: "/admin/cp/dashboard", access: ALL },
  { method: "GET", path: "/admin/cp/releases", access: ALL },
  {
    method: "POST",
    path: "/admin/cp/releases",
    access: SHOPS,
    stepUp: true,
    resource: { type: "release" },
  },
  {
    method: "POST",
    path: "/admin/cp/releases/:id",
    access: SHOPS,
    stepUp: true,
    resource: RELEASE,
  },
  {
    method: "POST",
    path: "/admin/cp/tenants/:id/target-release",
    access: SHOPS,
    stepUp: true,
    resource: { type: "tenant", param: "id" },
  },
]
