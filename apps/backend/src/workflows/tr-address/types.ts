import type { LevelSummary } from "../../modules/tr-address/service"

/** Where an import of the address reference data reads from (adr/0008 Ek 2026-11-04). */
export type TrAddressSource = "turkiyeapi" | "file"

export interface ImportTrAddressInput {
  source: TrAddressSource
  /** A file source's CSV or JSON on this machine (the CLI's). */
  file_path?: string
  /**
   * A file's places it lacks marked inactive (a complete national file
   * only). TürkiyeAPI's dataset is checked whole and always does.
   */
  deactivate_missing?: boolean
  /** Skip when the shop has this TürkiyeAPI dataset already (the weekly check). */
  only_if_changed?: boolean
  /** Who asked: a staff member, or null for the platform (the CLI, the weekly job). */
  actor_id: string | null
  /** The async job running it, told of progress (and asked whether it was cancelled). */
  job_id?: string | null
}

/** What an import did, in counts: the job's report and the audit entry. */
export interface TrAddressImportSummary {
  skipped: boolean
  source: TrAddressSource
  dataset_version: string | null
  last_updated: string | null
  provinces: LevelSummary | null
  districts: LevelSummary | null
  neighborhoods: LevelSummary | null
  /** Rows the import refused (a postal code of another province, a conflicting name). */
  rejected: number
  rejected_reasons: Record<string, number>
  /** TürkiyeAPI records whose district or province is not in the dataset. */
  orphans: number
}
