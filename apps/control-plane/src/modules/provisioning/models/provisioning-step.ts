import { model } from "@medusajs/framework/utils"
import { ProvisioningRun } from "./provisioning-run"

/**
 * Where a step stands: `pending` → `running` → `succeeded` | `skipped`
 * (nothing to do, or not yet available) | `failed`; `compensated` once a
 * later failure undid what it made.
 */
export const STEP_STATUSES = [
  "pending",
  "running",
  "succeeded",
  "skipped",
  "failed",
  "compensated",
] as const
export type StepStatus = (typeof STEP_STATUSES)[number]

/**
 * A step of a run (adr/0061 §2): its name and place, how it went, how many
 * times it was tried, whether **this run** made what it stands for
 * (`created`: the compensation undoes only that), an error code and a
 * small non-secret output (a port, a serial, whether a mail went). Never a
 * secret, a command's output or an invitation link.
 */
export const ProvisioningStep = model
  .define("provisioning_step", {
    id: model.id({ prefix: "pstep" }).primaryKey(),
    name: model.text(),
    position: model.number(),
    status: model.enum([...STEP_STATUSES]).default("pending"),
    attempts: model.number().default(0),
    created: model.boolean().default(false),
    error_code: model.text().nullable(),
    output: model.json().nullable(),
    started_at: model.dateTime().nullable(),
    finished_at: model.dateTime().nullable(),
    run: model.belongsTo(() => ProvisioningRun, { mappedBy: "steps" }),
  })
  .indexes([{ on: ["run_id", "position"], unique: true, where: "deleted_at IS NULL" }])
