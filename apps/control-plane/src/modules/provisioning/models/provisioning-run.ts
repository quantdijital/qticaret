import { model } from "@medusajs/framework/utils"
import { ProvisioningStep } from "./provisioning-step"

/**
 * What a run does (adr/0061 §2 `provisioning`): `create` sets a shop up
 * (and retries it: a new run that skips what exists), `stop` and `start`
 * its process, `invite` sends the owner's invitation again (Ek C10). The
 * others come with their tasks (`apply_pack` C12, `upgrade` F16.6).
 */
export const PROVISIONING_KINDS = [
  "create",
  "upgrade",
  "apply_pack",
  "rotate_keys",
  "stop",
  "start",
  "invite",
  "close",
] as const
export type ProvisioningKind = (typeof PROVISIONING_KINDS)[number]

/** `running` until it ends: `succeeded`, or `failed` (what it made undone; the shop stays as it was). */
export const RUN_STATUSES = ["running", "succeeded", "failed"] as const
export type RunStatus = (typeof RUN_STATUSES)[number]

export const PROVIDERS = ["local", "docker", "fake"] as const
export type ProviderKind = (typeof PROVIDERS)[number]

/**
 * One run of the provisioning workflow for a shop, with its steps. Holds
 * no secret and no personal data: the owner's address is read from the
 * shop's contacts when the invitation is sent (Ek C10). At most one run
 * of a shop is `running` at a time (partial unique index).
 */
export const ProvisioningRun = model
  .define("provisioning_run", {
    id: model.id({ prefix: "prun" }).primaryKey(),
    tenant_id: model.text(),
    kind: model.enum([...PROVISIONING_KINDS]),
    status: model.enum([...RUN_STATUSES]).default("running"),
    provider: model.enum([...PROVIDERS]),
    /** The staff member who asked; null for the system (a script). */
    requested_by: model.text().nullable(),
    /** The shop's port on this machine (local provisioner: 9200–9299). */
    port: model.number().nullable(),
    /** Why it failed: the failed step's code. */
    error_code: model.text().nullable(),
    started_at: model.dateTime(),
    finished_at: model.dateTime().nullable(),
    /** Moved at each step: a run whose process died is found by its silence. */
    heartbeat_at: model.dateTime(),
    steps: model.hasMany(() => ProvisioningStep, { mappedBy: "run" }),
  })
  .indexes([
    { on: ["tenant_id", "started_at"], where: "deleted_at IS NULL" },
    {
      name: "IDX_provisioning_run_one_running",
      on: ["tenant_id"],
      unique: true,
      where: "status = 'running' AND deleted_at IS NULL",
    },
    { on: ["port"], where: "port IS NOT NULL AND deleted_at IS NULL" },
  ])
  .cascades({ delete: ["steps"] })
