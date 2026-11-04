import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../../lib/logging"
import { postcodeOf } from "../../lib/shipping/geliver/mappers"
import type { AddressRow } from "../../lib/shipping/geliver/mappers"
import type { PlaceFacts } from "../../lib/shipping/fill"
import { TR_ADDRESS_MODULE } from "../../modules/tr-address"
import type TrAddressModuleService from "../../modules/tr-address/service"

const filled = (value: string | null | undefined): string => (value ?? "").trim()

/**
 * What the address data (TürkiyeAPI, adr/0008) says of an address without
 * a postcode: the postcode of its mahalle or köy (il + ilçe + `address_2`)
 * and its province's plate code. Null when the address has a postcode or
 * names no province. A lookup that fails costs the fill only, never the
 * shipment: it is logged and the carrier rule decides.
 */
export async function placeFactsOf(
  container: Pick<MedusaContainer, "resolve">,
  address: AddressRow | null | undefined
): Promise<PlaceFacts | null> {
  const province = filled(address?.province)
  if (postcodeOf(address?.postal_code) || !province) {
    return null
  }
  const district = filled(address?.city)
  const neighborhood = filled(address?.address_2)
  try {
    const found = await container.resolve<TrAddressModuleService>(TR_ADDRESS_MODULE).lookupAddress({
      province,
      ...(district ? { district } : {}),
      ...(neighborhood ? { neighborhood } : {}),
    })
    return {
      postal_code: found.neighborhood?.postal_code ?? null,
      plate: found.province?.code ?? null,
    }
  } catch (error) {
    logger.warn({ event: "shipping.place_lookup_failed", err: errorSummary(error) })
    return null
  }
}
