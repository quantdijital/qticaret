import { CP_ROUTES, decide, matchRoute } from "../route-table"
import { CP_STAFF_ROLES } from "../roles"

const allowedRoles = (method: string, path: string) => {
  const rule = matchRoute(method, path)?.rule ?? null
  return CP_STAFF_ROLES.filter((role) => decide(rule, { role, mfaPassed: true }).allowed)
}

describe("the route table's releases and dashboard (Ek C18)", () => {
  it("lets every role read the dashboard and the releases, without a step-up", () => {
    for (const path of ["/admin/cp/dashboard", "/admin/cp/releases"]) {
      expect(allowedRoles("GET", path)).toEqual([...CP_STAFF_ROLES])
      expect(matchRoute("GET", path)?.rule.stepUp).toBeUndefined()
      expect(matchRoute("GET", path)?.rule.auditRead).toBeUndefined()
    }
  })

  it("gives releases and a shop's target to who runs shops, each behind a step-up", () => {
    for (const [path, resource] of [
      ["/admin/cp/releases", { type: "release" }],
      ["/admin/cp/releases/rel_1", { type: "release", param: "id" }],
      ["/admin/cp/tenants/ten_1/target-release", { type: "tenant", param: "id" }],
    ] as const) {
      expect(allowedRoles("POST", path)).toEqual(["owner", "operator"])
      expect(matchRoute("POST", path)?.rule).toMatchObject({ stepUp: true, resource })
    }
  })

  it("has no route to delete a release (history) and no other method on them", () => {
    const rows = CP_ROUTES.filter(
      (rule) => rule.path.startsWith("/admin/cp/releases") || rule.path.endsWith("/target-release")
    ).map((rule) => `${rule.method} ${rule.path}`)

    expect(rows.sort()).toEqual([
      "GET /admin/cp/releases",
      "POST /admin/cp/releases",
      "POST /admin/cp/releases/:id",
      "POST /admin/cp/tenants/:id/target-release",
    ])
    expect(matchRoute("DELETE", "/admin/cp/releases/rel_1")).toBeNull()
  })
})
