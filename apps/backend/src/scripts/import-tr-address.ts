import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
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
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const filePath = args.find((arg) => !arg.startsWith("--"))
  if (!filePath) {
    throw new Error("tr-address import: pass the data file path")
  }

  const rows = await readAddressRows(filePath)
  const service = container.resolve<TrAddressModuleService>(TR_ADDRESS_MODULE)
  const startedAt = Date.now()
  const report = await service.importReferenceData(rows, {
    deactivateMissing: args.includes("--deactivate-missing"),
  })

  logger.info(
    `tr-address import: ${String(rows.length)} rows in ${String(Date.now() - startedAt)} ms; ` +
      `provinces ${JSON.stringify(report.provinces)}, districts ${JSON.stringify(report.districts)}, ` +
      `neighborhoods ${JSON.stringify(report.neighborhoods)}, rejected ${String(report.rejected.length)}`
  )
  for (const rejected of report.rejected.slice(0, 50)) {
    logger.warn(`tr-address import: row ${String(rejected.row)} rejected (${rejected.reason})`)
  }
}
