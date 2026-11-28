import { describe, expect, it } from "vitest"
import { FAILED, RUNNING, SET_UP, run, state } from "@/test/runs"
import { actionRules, lastKnownRunning } from "./rules"

const enabled = (rules: ReturnType<typeof actionRules>) =>
  (["create", "start", "stop", "invite", "apply_pack"] as const).filter(
    (action) => rules[action].enabled
  )

describe("the setup's actions by the control plane's rules (Ek C10)", () => {
  it("offers only Kur before any run", () => {
    const rules = actionRules(state(null), "provisioning")

    expect(enabled(rules)).toEqual(["create"])
    expect(rules.createLabel).toBe("setup.actions.install")
    expect(rules.start.reason).toBe("setup.reasons.notSetUp")
    expect(rules.apply_pack.reason).toBe("setup.reasons.notSetUp")
  })

  it("offers nothing while a run goes, nor without a provisioner, nor before the state is read", () => {
    expect(enabled(actionRules(state(RUNNING), "provisioning"))).toEqual([])
    expect(actionRules(state(RUNNING), "provisioning").create.reason).toBe("setup.reasons.busy")
    expect(enabled(actionRules({ ...state(null), provisioner: null }, "provisioning"))).toEqual([])
    expect(actionRules(undefined, "active").stop.reason).toBe("setup.reasons.loading")
  })

  it("offers Yeniden dene after a failed setup, nothing else until one goes through", () => {
    const rules = actionRules(state(FAILED), "provisioning")

    expect(enabled(rules)).toEqual(["create"])
    expect(rules.createLabel).toBe("setup.actions.retry")
  })

  it("offers start, stop and the invitation once set up; no setup again on an active shop", () => {
    const rules = actionRules(state(SET_UP, [FAILED]), "active")

    // C12: the sector pack again, beside them
    expect(enabled(rules)).toEqual(["start", "stop", "invite", "apply_pack"])
    expect(rules.create.reason).toBe("setup.reasons.done")
  })

  it("keeps a stop for any status, a start for a running one, the rest for one being set up or active", () => {
    // Ek C19 L2: a restricted or suspended shop keeps running; it may be started again
    for (const status of ["restricted", "suspended"] as const) {
      const rules = actionRules(state(SET_UP), status)

      expect(enabled(rules)).toEqual(["start", "stop"])
      expect(rules.invite.reason).toBe("setup.reasons.status")
      expect(rules.apply_pack.reason).toBe("setup.reasons.status")
    }
    const closing = actionRules(state(SET_UP), "closing")
    expect(enabled(closing)).toEqual(["stop"])
    expect(closing.start.reason).toBe("setup.reasons.status")
  })

  it("tells the shop's last known state from its runs", () => {
    const stopped = run({ id: "prun_2", kind: "stop" })

    expect(lastKnownRunning(state(null))).toBeNull()
    expect(lastKnownRunning(state(SET_UP))).toBe(true)
    expect(lastKnownRunning(state(stopped, [SET_UP]))).toBe(false)
    expect(lastKnownRunning(state(run({ id: "prun_3", kind: "start" }), [stopped]))).toBe(true)
  })

  it("offers a backup to any shop set up, closing too; an upgrade to one that sells or runs (audit 3.1/3.2)", () => {
    expect(actionRules(state(null), "provisioning").backup.reason).toBe("setup.reasons.notSetUp")
    for (const status of ["active", "restricted", "suspended"] as const) {
      const rules = actionRules(state(SET_UP), status)
      expect(rules.backup.enabled).toBe(true)
      expect(rules.upgrade.enabled).toBe(true)
    }
    const closing = actionRules(state(SET_UP), "closing")
    expect(closing.backup.enabled).toBe(true)
    expect(closing.upgrade.reason).toBe("setup.reasons.status")
    expect(actionRules(state(RUNNING), "active").upgrade.reason).toBe("setup.reasons.busy")
    // A finished upgrade leaves the shop running
    expect(lastKnownRunning(state(run({ id: "prun_9", kind: "upgrade" }), [SET_UP]))).toBe(true)
  })
})
