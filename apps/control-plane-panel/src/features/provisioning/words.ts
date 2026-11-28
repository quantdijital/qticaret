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
  "profile",
  "sector_pack",
  "preset",
  "plan_document",
  "start",
  "health",
  "api_url",
  "owner_invite",
  "activate",
  "stop",
  "resend_invite",
  // Audit 3.1/3.2: the upgrade's and the backup's
  "release",
  "backup",
  "upgrade_stop",
  "upgrade_start",
] as const

export const stepName = (t: TFunction, name: string): string =>
  (STEP_NAMES as readonly string[]).includes(name) ? t(`setup.steps.${name}`) : name

/** The run kinds this panel names; another is shown as written. */
export const RUN_KINDS = [
  "create",
  "start",
  "stop",
  "invite",
  "apply_pack",
  "backup",
  "upgrade",
] as const

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

const UNITS = ["kilobyte", "megabyte", "gigabyte", "terabyte"] as const

/** A backup's size: "820 kB", "12,4 MB", "1,2 GB" (audit 3.2). */
export function sizeText(bytes: number): string {
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return new Intl.NumberFormat("tr-TR", {
    style: "unit",
    unit: UNITS[unit],
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value)
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
  // C12: what the sector pack added this time, and what the shop's own kept
  if (step.name === "sector_pack" && typeof output["version"] === "number") {
    lines.push(t("setup.output.packVersion", { version: output["version"] }))
    if (typeof output["added"] === "number") {
      lines.push(t("setup.output.packAdded", { count: output["added"] }))
    }
    if (typeof output["kept"] === "number" && output["kept"] > 0) {
      lines.push(t("setup.output.packKept", { count: output["kept"] }))
    }
  }
  // Audit 1.3: how many of the shop's empty fields the profile filled (counts only)
  if (step.name === "profile") {
    for (const [key, text] of [
      ["filled", "setup.output.profileFilled"],
      ["kept", "setup.output.profileKept"],
      ["refused", "setup.output.profileRefused"],
    ] as const) {
      const count = output[key]
      if (typeof count === "number" && (count > 0 || key === "filled")) {
        lines.push(t(text, { count }))
      }
    }
  }
  // adr/0063 task 2.7: the look's version, and whether the storefront opened with it
  if (step.name === "preset" && typeof output["version"] === "number") {
    lines.push(t("setup.output.packVersion", { version: output["version"] }))
    if (output["applied"] === true) {
      lines.push(t("setup.output.presetApplied"))
    } else if (typeof output["published"] === "boolean") {
      lines.push(
        t(output["published"] ? "setup.output.presetPublished" : "setup.output.presetDraft")
      )
    }
  }
  // Audit 3.1: from what the shop reported to its target
  if (step.name === "release" && typeof output["to"] === "string") {
    lines.push(
      t("setup.output.release", {
        from: typeof output["from"] === "string" ? output["from"] : "—",
        to: output["to"],
      })
    )
  }
  // Audit 3.2: the backup's size, and whether the shop's files went with it
  if (step.name === "backup" && typeof output["bytes"] === "number") {
    lines.push(t("setup.output.backupSize", { size: sizeText(output["bytes"]) }))
    if (output["files"] === true) {
      lines.push(t("setup.output.backupFiles"))
    }
  }
  if (output["reason"] === "not_available_yet") {
    lines.push(t("setup.output.notAvailableYet"))
  }
  if ((step.name === "start" || step.name === "upgrade_start") && output["running"] === true) {
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
