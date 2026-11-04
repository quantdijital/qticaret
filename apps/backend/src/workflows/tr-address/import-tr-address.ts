import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { recordAuditEntryStep } from "../audit-log/steps/record-audit-entry"
import { checkTrAddressVersionStep } from "./steps/check-tr-address-version"
import { importTrAddressStep } from "./steps/import-tr-address"
import type { ImportTrAddressInput, TrAddressImportSummary } from "./types"

export type { ImportTrAddressInput, TrAddressImportSummary, TrAddressSource } from "./types"

/**
 * Imports the Turkish address reference data (adr/0008, Ek 2026-11-04):
 * from TürkiyeAPI (the weekly check's job, the CLI, provisioning) or
 * from a file (the CLI). With `only_if_changed`, a dataset the shop
 * already has is not downloaded. The import is recorded in the audit log
 * with its counts.
 */
export const importTrAddressWorkflow = createWorkflow(
  "tr-address-import",
  (input: ImportTrAddressInput) => {
    const check = checkTrAddressVersionStep(input)
    const imported = when(
      "tr-address-import-when-due",
      { check },
      ({ check }) => !check.current
    ).then(() => {
      const result = importTrAddressStep(input)
      const entry = transform({ input, result }, ({ input, result }) => ({
        action: "tr_address.imported",
        actor_type: input.actor_id ? "user" : "system",
        actor_id: input.actor_id,
        resource_type: "tr_address",
        resource_id: result.sync_id,
        changes: { ...result.summary, job_id: input.job_id ?? null },
      }))
      recordAuditEntryStep(entry)
      return result
    })
    const summary = transform(
      { input, check, imported },
      ({ input, check, imported }): TrAddressImportSummary =>
        imported?.summary ?? {
          skipped: true,
          source: input.source,
          dataset_version: check.meta?.datasetVersion ?? null,
          last_updated: check.meta?.lastUpdated ?? null,
          provinces: null,
          districts: null,
          neighborhoods: null,
          rejected: 0,
          rejected_reasons: {},
          orphans: 0,
        }
    )
    return new WorkflowResponse(summary)
  }
)
