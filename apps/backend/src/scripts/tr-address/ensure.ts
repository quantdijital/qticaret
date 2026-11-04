import type { MedusaContainer } from "@medusajs/framework/types"
import { isValidationError } from "../../lib/errors"
import { logger } from "../../lib/logging"
import { TR_ADDRESS_MODULE } from "../../modules/tr-address"
import type TrAddressModuleService from "../../modules/tr-address/service"
import { importTrAddressWorkflow } from "../../workflows/tr-address/import-tr-address"

/**
 * A new shop gets the whole country's address data from TürkiyeAPI
 * (adr/0008 Ek 2026-11-04) when it never had an import: provisioning and
 * the demo seed call this. Without the network it is skipped with a
 * warning, never failing the command: the weekly check fills it in, or
 * the operator runs `tr-address:import source=turkiyeapi`. An import
 * done before (TürkiyeAPI's or an operator's file) is kept.
 */
export async function ensureTrAddressData(container: MedusaContainer): Promise<void> {
  const service = container.resolve<TrAddressModuleService>(TR_ADDRESS_MODULE)
  if (await service.latestSync()) {
    logger.info({ event: "tr_address.data_kept" }, "address data imported before, kept")
    return
  }
  try {
    const { result } = await importTrAddressWorkflow(container).run({
      input: { source: "turkiyeapi", actor_id: null },
    })
    logger.info(
      {
        event: "tr_address.data_loaded",
        datasetVersion: result.dataset_version,
        provinces: result.provinces,
        districts: result.districts,
        neighborhoods: result.neighborhoods,
        rejected: result.rejected,
      },
      "address data loaded from TürkiyeAPI"
    )
  } catch (error) {
    logger.warn(
      {
        event: "tr_address.data_not_loaded",
        code: isValidationError(error) ? error.safeMessage : "failed",
      },
      "address data not loaded (is the network up?): the weekly check retries, or run tr-address:import source=turkiyeapi"
    )
  }
}
