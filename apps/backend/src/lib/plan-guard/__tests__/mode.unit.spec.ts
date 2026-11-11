import { TENANT_STATUSES } from "@qticaret/types/control-plane"
import { planModeFor, planModeOf, shownStatusOf } from ".."
import { DEFAULT_PLAN_STATE } from "../../../modules/control-plane/types"
import type { PlanState } from "../../../modules/control-plane/types"

const containerWith = (state: PlanState) => ({
  resolve: () => ({ planState: () => Promise.resolve(state) }),
})

describe("the shop's plan mode", () => {
  it("maps every status: restricted, suspended or closer, else open", () => {
    const modes = Object.fromEntries(TENANT_STATUSES.map((status) => [status, planModeOf(status)]))
    expect(modes).toEqual({
      provisioning: "open",
      active: "open",
      restricted: "restricted",
      suspended: "suspended",
      closing: "suspended",
      closed: "suspended",
    })
  })

  it("names the status a staff member is told", () => {
    expect(shownStatusOf("open")).toBe("active")
    expect(shownStatusOf("restricted")).toBe("restricted")
    expect(shownStatusOf("suspended")).toBe("suspended")
  })

  it("follows the signed document when managed", async () => {
    const managed = { ...DEFAULT_PLAN_STATE(true), status: "suspended" as const }
    await expect(planModeFor(containerWith(managed))).resolves.toBe("suspended")
    const restricted = { ...managed, status: "restricted" as const }
    await expect(planModeFor(containerWith(restricted))).resolves.toBe("restricted")
  })

  it("never closes an unmanaged shop, whatever a stored document said", async () => {
    const unmanaged = { ...DEFAULT_PLAN_STATE(false), status: "suspended" as const }
    await expect(planModeFor(containerWith(unmanaged))).resolves.toBe("open")
  })
})
