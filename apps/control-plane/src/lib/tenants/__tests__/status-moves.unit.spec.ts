import { TENANT_STATUSES, canTransitionTenant } from "@qticaret/types/control-plane"
import { MOVE_STARTS, moveTarget, resumeTarget } from "../status-moves"

describe("a suspension and its end (adr/0061 Ek C15)", () => {
  it("suspends an active or restricted shop, nothing else", () => {
    const suspended = TENANT_STATUSES.filter(
      (status) => moveTarget("suspend", status, null) === "suspended"
    )
    expect(suspended).toEqual(["active", "restricted"])
  })

  it("opens only a suspended shop, back to where it stood", () => {
    expect(moveTarget("resume", "suspended", "active")).toBe("active")
    expect(moveTarget("resume", "suspended", "restricted")).toBe("restricted")
    // No earlier row (a record made before C15): active
    expect(moveTarget("resume", "suspended", null)).toBe("active")
    for (const status of TENANT_STATUSES.filter((each) => each !== "suspended")) {
      expect(moveTarget("resume", status, "restricted")).toBeNull()
    }
  })

  it("never resumes to anything but active or restricted", () => {
    for (const before of [...TENANT_STATUSES, null]) {
      expect(["active", "restricted"]).toContain(resumeTarget(before))
    }
  })

  it("moves only along the contract's transitions", () => {
    for (const [move, starts] of Object.entries(MOVE_STARTS)) {
      for (const from of starts) {
        for (const before of ["active", "restricted"] as const) {
          const to = moveTarget(move as "suspend" | "resume", from, before)
          expect(to).not.toBeNull()
          expect(canTransitionTenant(from, to ?? "closed")).toBe(true)
        }
      }
    }
  })
})
