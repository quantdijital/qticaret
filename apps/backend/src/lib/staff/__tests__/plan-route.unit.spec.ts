import { STAFF_ROLES, capabilitiesOf, decide } from "../permissions"

/**
 * adr/0061 Ek C14: Settings > Abonelik (`GET /admin/plan`) is the owner's
 * and admins', the roles the panel offers settings to; the panel shows the
 * page by the `settings` capability, so the two never disagree.
 */
describe("GET /admin/plan by role", () => {
  it.each(STAFF_ROLES)("%s reads it exactly when it has settings", (role) => {
    expect(decide(role, "GET", "/admin/plan").allowed).toBe(capabilitiesOf(role).settings)
  })

  it("is the owner's and admins' only", () => {
    expect(STAFF_ROLES.filter((role) => decide(role, "GET", "/admin/plan").allowed)).toEqual([
      "owner",
      "admin",
    ])
    expect(decide("readonly", "GET", "/admin/plan").reason).toBe("private")
  })

  // Ek C20: the payments to the platform go with the plan, to the same roles
  it.each(STAFF_ROLES)("%s reads the payments exactly as it reads the plan", (role) => {
    expect(decide(role, "GET", "/admin/plan/payments").allowed).toBe(
      decide(role, "GET", "/admin/plan").allowed
    )
  })
})
