import { z } from "zod"
import type { MigrationSourceKind, StartMigration } from "@/features/settings/api/migration"
import { CATEGORY_BASE } from "@/features/settings/api/migration-wordpress"
import type { RunKindName } from "@/features/settings/api/migration-overview"
import { NO_PARCEL, readParcel } from "@/features/settings/components/migration/parcel"
import type { ParcelText } from "@/features/settings/components/migration/parcel"
import { fileProblem } from "@/features/settings/components/migration/wxr-file"

/** The new migration's five steps (adr/0042 Ek 2026-11-27). */
export const WIZARD_STEPS = ["source", "file", "kinds", "transfer", "result"] as const
export type WizardStepKey = (typeof WIZARD_STEPS)[number]

/** What the owner chose so far; the file stays in the page and is sent again to apply. */
export interface WizardDraft {
  source: MigrationSourceKind
  file: File | null
  url: string
  categoryBase: string
  parcel: ParcelText
}

export const emptyDraft = (source: MigrationSourceKind = "wordpress"): WizardDraft => ({
  source,
  file: null,
  url: "",
  categoryBase: "",
  parcel: NO_PARCEL,
})

const FILE_SOURCES = new Set<MigrationSourceKind>(["wordpress", "customers", "bundle"])
const url = z.url({ protocol: /^https?$/ })

/** What keeps the file step from going on, as an i18n key; null: ready. */
export function draftProblem(draft: WizardDraft): string | null {
  if (draft.source === "wordpress") {
    const problem = fileProblem(draft.file)
    if (problem) {
      return problem
    }
    const base = draft.categoryBase.trim()
    if (base.length > 64 || !CATEGORY_BASE.test(base)) {
      return "settings.migration.wordpress.errors.categoryBase"
    }
  } else if (FILE_SOURCES.has(draft.source) && !draft.file) {
    return "settings.migration.wizard.fileRequired"
  }
  if (draft.source === "feed" && !url.safeParse(draft.url.trim()).success) {
    return "settings.migration.wizard.urlRequired"
  }
  if (draft.source !== "customers" && readParcel(draft.parcel) === "invalid") {
    return "settings.migration.wordpress.errors.parcel"
  }
  return null
}

/** The request a preview (`check`) or the transfer (`apply`) sends. */
export function startOf(
  draft: WizardDraft,
  mode: "check" | "apply",
  kinds: readonly RunKindName[] = []
): StartMigration {
  const parcel = draft.source === "customers" ? null : readParcel(draft.parcel)
  return {
    kind: draft.source,
    mode,
    parcel: parcel === "invalid" ? null : parcel,
    file: draft.file,
    url: draft.url.trim(),
    categoryBase: draft.categoryBase.trim(),
    kinds,
  }
}
