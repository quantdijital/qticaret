import type { ExecArgs } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { TR_ADDRESS_MODULE } from "../modules/tr-address"
import type TrAddressModuleService from "../modules/tr-address/service"
import { readAddressRows } from "./tr-address/read-rows"

/**
 * Loads address reference data supplied at provisioning (adr/0008; the data
 * file is never committed).
 *
 * Usage: pnpm --filter @qticaret/backend tr-address:import <file.csv|json> [--deactivate-missing]
 *
 * --deactivate-missing marks places absent from the file inactive; use it
 * only with a complete national dataset.
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  const filePath = args.find((arg) => !arg.startsWith("--"))
  if (!filePath) {
    throw new Error("tr-address import: pass the data file path")
  }

  const rows = await readAddressRows(filePath)
  const service = container.resolve<TrAddressModuleService>(TR_ADDRESS_MODULE)
  const startedAt = Date.now()
  const report = await service.importReferenceData(rows, {
    shouldDeactivateMissing: args.includes("--deactivate-missing"),
  })

  logger.info(
    {
      event: "tr_address.import_completed",
      rows: rows.length,
      durationMs: Date.now() - startedAt,
      provinces: report.provinces,
      districts: report.districts,
      neighborhoods: report.neighborhoods,
      rejected: report.rejected.length,
    },
    "tr-address import completed"
  )
  for (const rejected of report.rejected.slice(0, 50)) {
    logger.warn(
      { event: "tr_address.row_rejected", row: rejected.row, reason: rejected.reason },
      "row rejected"
    )
  }
}
