import type { ExecArgs } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { importTrAddressWorkflow } from "../workflows/tr-address/import-tr-address"
import { parseImportArgs } from "./tr-address/args"

/**
 * Loads the Turkish address reference data (adr/0008, Ek 2026-11-04).
 *
 * Usage:
 *   pnpm --filter @qticaret/backend tr-address:import source=turkiyeapi [if-changed]
 *   pnpm --filter @qticaret/backend tr-address:import <file.csv|json> [deactivate-missing]
 *
 * TürkiyeAPI's dataset is the whole country (81 provinces, every district,
 * neighbourhood and village), checked complete before anything is written;
 * places it no longer has are marked inactive, never deleted. A file is an
 * operator's own data (never committed); `deactivate-missing` only with a
 * complete national file. Runs the same workflow as the panel's button,
 * so the import is recorded and audited the same way.
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  const input = parseImportArgs(args)
  const startedAt = Date.now()
  const { result } = await importTrAddressWorkflow(container).run({
    input: { ...input, actor_id: null },
  })
  logger.info(
    {
      event: result.skipped ? "tr_address.import_skipped" : "tr_address.import_completed",
      source: result.source,
      datasetVersion: result.dataset_version,
      lastUpdated: result.last_updated,
      durationMs: Date.now() - startedAt,
      provinces: result.provinces,
      districts: result.districts,
      neighborhoods: result.neighborhoods,
      rejected: result.rejected,
      rejectedReasons: result.rejected_reasons,
      orphans: result.orphans,
    },
    result.skipped ? "tr-address data is current, nothing imported" : "tr-address import completed"
  )
}
