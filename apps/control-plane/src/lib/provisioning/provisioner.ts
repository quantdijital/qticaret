import type { RuntimeSecrets } from "../vault/tenant-secrets"

/**
 * Where a shop runs, behind one interface (adr/0061 §6.1): the setup's
 * steps live once, in the `provisioning` workflow; what differs between a
 * developer's machine (`LocalProvisioner`) and the server (Docker, F16) is
 * here. The methods are the ADR's; their types are made concrete.
 */

/** The shop as the provisioner sees it: no secret, no personal data. */
export interface ProvisionTarget {
  tenant_id: string
  slug: string
  /** The shop backend's port (local: 9200–9299). */
  port: number
  /** `CONTROL_PLANE_PUBLIC_KEYS`: the control plane's published keys, comma-separated. */
  public_keys: string
}

/**
 * The closed list of what may run in a shop (adr/0061 §3.4): no free
 * command. `plan-import` hands its document on stdin; `invite-owner`'s
 * result carries the owner's link, which the caller uses and forgets.
 */
export type TenantCommand =
  | { name: "migrate" }
  | { name: "bootstrap"; store_name: string }
  | { name: "invite-owner"; email: string }
  | { name: "apply-pack"; pack: string }
  | { name: "plan-import"; document: string }

export const TENANT_COMMANDS = [
  "migrate",
  "bootstrap",
  "invite-owner",
  "apply-pack",
  "plan-import",
] as const satisfies readonly TenantCommand["name"][]

/**
 * How a command went. Never its output: only its exit, its time and the
 * one result line it printed (`QT_TENANT_RESULT`, parsed), if any.
 */
export interface CommandResult {
  ok: boolean
  exit_code: number | null
  timed_out: boolean
  duration_ms: number
  result: unknown
}

/**
 * What the provisioner sees of a shop: its secret store, its process and
 * its health. The steps read it to skip what already exists (adr/0061
 * §6.2: a retry runs from the start and skips what is there).
 */
export interface HealthResult {
  /** The shop's runtime secrets are in its store. */
  secrets: boolean
  /** A process this provisioner started is running for it. */
  running: boolean
  /** `/health` answered 200. */
  healthy: boolean
  status: number | null
  latency_ms: number | null
}

export interface TenantProvisioner {
  readonly kind: "local" | "docker" | "fake"
  /** The shop's database and its least-privileged role; `created` when this call made the database. */
  ensureDatabase(t: ProvisionTarget): Promise<{ created: boolean }>
  /** Compensation only: the shop's database and role, made by this run. */
  dropDatabase(t: ProvisionTarget): Promise<void>
  /** The shop's runtime secrets into its own store (local: a 0600 env file). */
  writeRuntimeSecrets(t: ProvisionTarget, secrets: RuntimeSecrets): Promise<void>
  removeRuntimeSecrets(t: ProvisionTarget): Promise<void>
  /** One command of the closed list, without a shell, with a time limit. */
  runTenantCommand(t: ProvisionTarget, cmd: TenantCommand): Promise<CommandResult>
  start(t: ProvisionTarget): Promise<void>
  /** Stops only a process this provisioner started for the shop. */
  stop(t: ProvisionTarget): Promise<void>
  probe(t: ProvisionTarget): Promise<HealthResult>
}

/** A provisioner's refusal or failure, as a code the run records (never a value). */
export class ProvisioningError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = "ProvisioningError"
  }
}
