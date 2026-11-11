import type { TenantStatus } from "@qticaret/types/control-plane"
import type { ProvisioningState, RunAction } from "./api"

/**
 * Which of the setup's actions can start now, by the control plane's own
 * rules (Ek C10), so a button is not offered where it would refuse: one
 * run of a shop at a time (409 `cp.provisioning_busy`), none without a
 * provisioner (503), a start or an invitation only for a shop being set
 * up or active (409 `provisioning.tenant_status`; a stop in any status).
 * Starting, stopping, inviting and applying the sector pack again (C12)
 * need a shop that was set up once. The control plane decides again.
 */

export interface ActionRule {
  enabled: boolean
  /** Why not, as a text key; null when it can start. */
  reason: string | null
}

export type ActionRules = Record<RunAction, ActionRule> & {
  /** "Kur" before any setup, "Yeniden dene" after one. */
  createLabel: "setup.actions.install" | "setup.actions.retry"
}

const LIVE: readonly TenantStatus[] = ["provisioning", "active"]

const yes: ActionRule = { enabled: true, reason: null }
const no = (reason: string): ActionRule => ({ enabled: false, reason })

/** Whether the shop was set up once (a setup run went to its end). */
export const wasSetUp = (state: ProvisioningState): boolean =>
  state.runs.some((run) => run.kind === "create" && run.status === "succeeded")

/**
 * The shop's backend as the runs last left it: up after a setup or a
 * start, down after a stop; null before any. Only what the runs say: a
 * process that died since is not seen here (C13 brings the health check).
 */
export function lastKnownRunning(state: ProvisioningState): boolean | null {
  const last = state.runs.find(
    (run) => run.status === "succeeded" && ["create", "start", "stop"].includes(run.kind)
  )
  return last ? last.kind !== "stop" : null
}

export function actionRules(
  state: ProvisioningState | undefined,
  status: TenantStatus
): ActionRules {
  const createLabel = state?.runs.some((run) => run.kind === "create")
    ? "setup.actions.retry"
    : "setup.actions.install"
  const all = (rule: ActionRule): ActionRules => ({
    create: rule,
    stop: rule,
    start: rule,
    invite: rule,
    apply_pack: rule,
    createLabel,
  })
  if (!state) {
    return all(no("setup.reasons.loading"))
  }
  if (state.provisioner === null) {
    return all(no("setup.reasons.noProvisioner"))
  }
  if (state.latest?.status === "running") {
    return all(no("setup.reasons.busy"))
  }
  const live = LIVE.includes(status)
  const setUp = wasSetUp(state)
  const needsLive = (rule: ActionRule) => (live ? rule : no("setup.reasons.status"))
  const needsSetUp = setUp ? yes : no("setup.reasons.notSetUp")
  return {
    // Set up and active: nothing left to do (a setup run again would only skip)
    create: needsLive(setUp && status === "active" ? no("setup.reasons.done") : yes),
    stop: needsSetUp,
    start: needsSetUp.enabled ? needsLive(yes) : needsSetUp,
    invite: needsSetUp.enabled ? needsLive(yes) : needsSetUp,
    apply_pack: needsSetUp.enabled ? needsLive(yes) : needsSetUp,
    createLabel,
  }
}
