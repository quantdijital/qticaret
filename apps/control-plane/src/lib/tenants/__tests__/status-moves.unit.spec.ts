import { TENANT_STATUSES, canTransitionTenant } from "@qticaret/types/control-plane"
import { MOVE_STARTS, moveTarget, resumeTarget } from "../status-moves"

describe("a suspension and its end (adr/0061 Ek C15, C16)", () => {
  it("suspends an active or restricted shop, nothing else", () => {
    const suspended = TENANT_STATUSES.filter(
      (status) => moveTarget("suspend", status, false) === "suspended"
    )
    expect(suspended).toEqual(["active", "restricted"])
  })

  it("opens only a suspended shop, by its payments (Ek C16)", () => {
    expect(moveTarget("resume", "suspended", false)).toBe("active")
    expect(moveTarget("resume", "suspended", true)).toBe("restricted")
    for (const status of TENANT_STATUSES.filter((each) => each !== "suspended")) {
      expect(moveTarget("resume", status, true)).toBeNull()
    }
  })

  it("never resumes to anything but active or restricted", () => {
    expect(resumeTarget(false)).toBe("active")
    expect(resumeTarget(true)).toBe("restricted")
  })

  it("moves only along the contract's transitions", () => {
    for (const [move, starts] of Object.entries(MOVE_STARTS)) {
      for (const from of starts) {
        for (const overdue of [false, true]) {
          const to = moveTarget(move as "suspend" | "resume", from, overdue)
          expect(to).not.toBeNull()
          expect(canTransitionTenant(from, to ?? "closed")).toBe(true)
        }
      }
    }
  })
})
