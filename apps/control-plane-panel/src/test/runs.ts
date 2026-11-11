import type { ProvisioningState, Run, RunStep } from "@/features/provisioning/api"

const AT = "2026-11-11T10:00:00.000Z"
const later = (seconds: number) => new Date(Date.parse(AT) + seconds * 1000).toISOString()

/** A step as the control plane answers it. */
export const step = (name: string, extra: Partial<RunStep> = {}): RunStep => ({
  name,
  position: 0,
  status: "succeeded",
  attempts: 1,
  created: false,
  error_code: null,
  output: null,
  started_at: AT,
  finished_at: later(2),
  ...extra,
})

/** A run as the control plane answers it. */
export const run = (extra: Partial<Run> = {}): Run => ({
  id: "prun_1",
  kind: "create",
  status: "succeeded",
  provider: "local",
  requested_by: "user_me",
  port: 9200,
  error_code: null,
  started_at: AT,
  finished_at: later(75),
  ...extra,
})

/** A setup that went to its end, the invitation not mailed (a warning). */
export const SET_UP: Run = run({
  steps: [
    step("allocate", { position: 0, output: { port: 9200, reused: false }, created: true }),
    step("migrate", { position: 3, finished_at: later(12) }),
    step("plan_document", { position: 6, output: { serial: 1, imported: "applied" } }),
    step("health", { position: 8, output: { status: 200, latency_ms: 35 } }),
    step("owner_invite", {
      position: 10,
      error_code: "provisioning.mail_off",
      output: { mailed: false },
    }),
    step("activate", { position: 11, output: { status: "active", serial: 2 } }),
  ],
})

/** A setup under way: the database done, the migrations running. */
export const RUNNING: Run = run({
  status: "running",
  finished_at: null,
  steps: [
    step("allocate", { position: 0, output: { port: 9200 } }),
    step("database", { position: 2 }),
    step("migrate", { position: 3, status: "running", finished_at: null }),
    step("bootstrap", { position: 4, status: "pending", started_at: null, finished_at: null }),
  ],
})

/** A setup that failed and was undone. */
export const FAILED: Run = run({
  id: "prun_0",
  status: "failed",
  error_code: "provisioning.health_timeout",
  steps: [
    step("database", { position: 2, status: "compensated", created: true }),
    step("health", {
      position: 8,
      status: "failed",
      attempts: 2,
      error_code: "provisioning.health_timeout",
    }),
  ],
})

export const state = (latest: Run | null, older: Run[] = []): ProvisioningState => ({
  provisioner: "local",
  latest,
  runs: latest ? [latest, ...older] : older,
})
