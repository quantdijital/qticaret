import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { createTurkiyeApi, readTurkiyeApiMeta } from "../../../lib/tr-address/turkiyeapi"
import type { TurkiyeApiMeta } from "../../../lib/tr-address/turkiyeapi"
import { TR_ADDRESS_MODULE } from "../../../modules/tr-address"
import type TrAddressModuleService from "../../../modules/tr-address/service"
import type { ImportTrAddressInput } from "../types"

export interface TrAddressVersionCheck {
  /** The stored data is this dataset already (asked only with `only_if_changed`). */
  current: boolean
  /** TürkiyeAPI's `/meta`; null for a file. */
  meta: TurkiyeApiMeta | null
}

/**
 * Which TürkiyeAPI dataset is out (`/meta`), and whether the shop already
 * has it: the last import was TürkiyeAPI's, of the same version and date.
 * A read only, on our side and theirs: nothing to undo.
 */
export const checkTrAddressVersionStep = createStep(
  "tr-address-check-version",
  async (input: ImportTrAddressInput, { container }) => {
    if (input.source !== "turkiyeapi") {
      return new StepResponse<TrAddressVersionCheck>({ current: false, meta: null })
    }
    const meta = await readTurkiyeApiMeta(createTurkiyeApi())
    if (!input.only_if_changed) {
      return new StepResponse<TrAddressVersionCheck>({ current: false, meta })
    }
    const latest = await container.resolve<TrAddressModuleService>(TR_ADDRESS_MODULE).latestSync()
    const current =
      latest?.source === "turkiyeapi" &&
      latest.dataset_version === meta.datasetVersion &&
      latest.dataset_last_updated === meta.lastUpdated
    return new StepResponse<TrAddressVersionCheck>({ current, meta })
  }
)
