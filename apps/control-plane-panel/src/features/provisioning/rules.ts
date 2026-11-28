import type { TenantStatus } from "@qticaret/types/control-plane"
import type { TenantDetail } from "@/features/tenants/api"
import type { ProvisioningState, RunAction } from "./api"

/**
 * Which of the setup's actions can start now, by the control plane's own
 * rules (Ek C10), so a button is not offered where it would refuse: one
 * run of a shop at a time (409 `cp.provisioning_busy`), none without a
 * provisioner (503), an invitation or the sector pack only for a shop
 * being set up or active, a start also for a restricted or suspended one
 * (Ek C19 L2: it keeps running) (409 `provisioning.tenant_status`; a stop
 * in any status; the control plane's `RUN_STATUSES`).
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
const STARTABLE: readonly TenantStatus[] = [...LIVE, "restricted", "suspended"]
// Audit 3.1/3.2: as the control plane's `RUN_STATUSES`
const UPGRADABLE: readonly TenantStatus[] = ["active", "restricted", "suspended"]
const BACKED_UP: readonly TenantStatus[] = [...STARTABLE, "closing"]

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
    (run) => run.status === "succeeded" && ["create", "start", "stop", "upgrade"].includes(run.kind)
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
    backup: rule,
    upgrade: rule,
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
  const inStatus = (list: readonly TenantStatus[]) =>
    list.includes(status) ? yes : no("setup.reasons.status")
  return {
    // Set up and active: nothing left to do (a setup run again would only skip)
    create: needsLive(setUp && status === "active" ? no("setup.reasons.done") : yes),
    stop: needsSetUp,
    start: needsSetUp.enabled
      ? STARTABLE.includes(status)
        ? yes
        : no("setup.reasons.status")
      : needsSetUp,
    invite: needsSetUp.enabled ? needsLive(yes) : needsSetUp,
    apply_pack: needsSetUp.enabled ? needsLive(yes) : needsSetUp,
    backup: needsSetUp.enabled ? inStatus(BACKED_UP) : needsSetUp,
    upgrade: needsSetUp.enabled ? inStatus(UPGRADABLE) : needsSetUp,
    createLabel,
  }
}

/**
 * Whether "Sürümü yükselt" can start (audit 3.1): the setup's rules (a
 * provisioner, no run under way, a shop set up and selling or running),
 * a target chosen, and the shop not already reporting it.
 */
export function upgradeRule(state: ProvisioningState | undefined, shop: TenantDetail): ActionRule {
  const rule = actionRules(state, shop.tenant.status).upgrade
  if (!rule.enabled) {
    return rule
  }
  if (!shop.version.target) {
    return { enabled: false, reason: "upgrade.noTarget" }
  }
  if (shop.version.matches === true) {
    return { enabled: false, reason: "upgrade.onTarget" }
  }
  return rule
}
