import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { TR_ADDRESS_MODULE } from "../../modules/tr-address"
import type TrAddressModuleService from "../../modules/tr-address/service"
import type { AddressFields } from "../../modules/tr-address/validation"
import { validateTrAddress } from "../../modules/tr-address/validation"

/**
 * Throws INVALID_DATA when any labelled address contradicts the reference
 * data (F1.4). Used by workflow hooks, the second line of defence behind the
 * Store API middleware; the message lists `label.field: code` pairs only.
 */
export async function assertTrAddresses(
  container: MedusaContainer,
  addresses: [label: string, address: AddressFields][]
): Promise<void> {
  const service = container.resolve<TrAddressModuleService>(TR_ADDRESS_MODULE)
  const codes: string[] = []
  for (const [label, address] of addresses) {
    for (const issue of await validateTrAddress(service, address)) {
      codes.push(`${label}.${issue.field}: ${issue.code}`)
    }
  }
  if (codes.length > 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Invalid Turkish address (${codes.join(", ")})`
    )
  }
}
