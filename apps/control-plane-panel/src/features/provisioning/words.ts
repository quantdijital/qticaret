import type { TFunction } from "i18next"
import { CP_ERROR_CODES, PROVISIONING_CODES } from "@/lib/errors"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import type { Run, RunStep } from "./api"

/**
 * A run in this panel's words (Ek C10): the steps' Turkish names, a code
 * (`provisioning.*`, `cp.*`) as a sentence, and the steps' non-secret
 * outputs worth showing. A code this panel does not know yet is said
 * generically; its key stays visible beside it for whoever looks into it.
 */

/** Every step a run has today, in its order (`RUN_STEPS` in the control plane). */
export const STEP_NAMES = [
  "allocate",
  "secrets",
  "database",
  "migrate",
  "bootstrap",
  "sector_pack",
  "plan_document",
  "start",
  "health",
  "api_url",
  "owner_invite",
  "activate",
  "stop",
  "resend_invite",
] as const

export const stepName = (t: TFunction, name: string): string =>
  (STEP_NAMES as readonly string[]).includes(name) ? t(`setup.steps.${name}`) : name

/** The run kinds this panel names; another is shown as written. */
export const RUN_KINDS = ["create", "start", "stop", "invite"] as const

export const kindName = (t: TFunction, kind: string): string =>
  (RUN_KINDS as readonly string[]).includes(kind) ? t(`setup.kinds.${kind}`) : kind

const PROVISIONING = /^provisioning\.([a-z_]+)$/
const COMPENSATION = /^provisioning\.compensation_failed:(.+)$/
const CP = /^cp\.([a-z_]+)$/

const known = (list: readonly string[], name: string | undefined): name is string =>
  name !== undefined && list.includes(name)

/** The words for a code on a run or a step; null when there is none. */
export function codeText(t: TFunction, code: string | null | undefined): string | null {
  if (!code) {
    return null
  }
  const undo = COMPENSATION.exec(code)?.[1]
  if (undo) {
    return t("setup.compensationFailed", { reason: codeText(t, undo) })
  }
  const name = PROVISIONING.exec(code)?.[1]
  if (known(PROVISIONING_CODES, name)) {
    return t(`errors.provisioning.${name}`)
  }
  const cp = CP.exec(code)?.[1]
  if (known(CP_ERROR_CODES, cp)) {
    return t(`errors.cp.${cp}`)
  }
  return t("setup.unknownCode")
}

/** A step that went but warns: its code says what did not (an invite not mailed). */
export const isWarning = (step: RunStep): boolean =>
  (step.status === "succeeded" || step.status === "skipped") && step.error_code !== null

/** How long a step or a run took: "12 sn", "1 dk 5 sn"; null while it has not ended. */
export function durationText(t: TFunction, from: string | null, to: string | null): string | null {
  if (!from || !to) {
    return null
  }
  const seconds = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000))
  if (seconds < 60) {
    return t("setup.seconds", { count: seconds })
  }
  return t("setup.minutes", { minutes: Math.floor(seconds / 60), seconds: seconds % 60 })
}

/** A step's outputs worth a person's eye: its port, a document's number, a reply's time, a mail. */
export function outputText(t: TFunction, step: RunStep): string[] {
  const output = step.output ?? {}
  const lines: string[] = []
  if (typeof output["port"] === "number") {
    lines.push(t("setup.output.port", { port: output["port"] }))
  }
  if (typeof output["serial"] === "number") {
    lines.push(t("setup.output.serial", { serial: output["serial"] }))
  }
  if (typeof output["latency_ms"] === "number") {
    lines.push(t("setup.output.latency", { ms: output["latency_ms"] }))
  }
  if (output["sent_before"] === true) {
    lines.push(t("setup.output.sentBefore"))
  } else if (output["owner"] === "exists") {
    lines.push(t("setup.output.ownerExists"))
  } else if (typeof output["mailed"] === "boolean") {
    lines.push(t(output["mailed"] ? "setup.output.mailed" : "setup.output.notMailed"))
  }
  if (output["reason"] === "not_available_yet") {
    lines.push(t("setup.output.notAvailableYet"))
  }
  if (step.name === "start" && output["running"] === true) {
    lines.push(t("setup.output.alreadyRunning"))
  }
  return lines
}

/** A run in one line: its kind, when it started, how long it took. */
export const runLine = (t: TFunction, run: Run): string =>
  [
    kindName(t, run.kind),
    formatDateTime(run.started_at),
    durationText(t, run.started_at, run.finished_at),
  ]
    .filter(Boolean)
    .join(" · ")
