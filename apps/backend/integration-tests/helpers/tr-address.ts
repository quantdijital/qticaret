import { resolve } from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import { TR_ADDRESS_MODULE } from "../../src/modules/tr-address"
import type TrAddressModuleService from "../../src/modules/tr-address/service"
import { readAddressRows } from "../../src/lib/tr-address/file/read-rows"

export const TR_ADDRESS_FIXTURE = resolve(__dirname, "../fixtures/tr-address.csv")

export function trAddressService(container: MedusaContainer): TrAddressModuleService {
  return container.resolve<TrAddressModuleService>(TR_ADDRESS_MODULE)
}

/** Loads the hand-made fixture (6 provinces, 8 districts, 11 neighborhoods). */
export async function loadTrAddressFixture(container: MedusaContainer): Promise<void> {
  await trAddressService(container).importReferenceData(await readAddressRows(TR_ADDRESS_FIXTURE))
}
