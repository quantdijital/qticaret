import type { MedusaContainer } from "@medusajs/framework/types"
import { ValidationError } from "../../lib/errors"
import type { CarrierName } from "../../lib/shipping/carriers"
import { arasApi, arasCredentialsOf, arasStatusOf } from "../../lib/shipping/aras"
import { geliverApi, geliverCredentialsOf, geliverStatusOf } from "../../lib/shipping/geliver"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type { CredentialProviderName } from "../../modules/integration-credentials/providers"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import type { ShipmentStatus } from "../../modules/shipment-tracking/states"

/** Where a carrier says the parcel is, in our own statuses (adr/0031). */
export interface CarrierReading {
  status: ShipmentStatus
  provider_status: string | null
  tracking_number: string | null
  tracking_url: string | null
}

type Reader = (
  container: Pick<MedusaContainer, "resolve">,
  providerShipmentId: string
) => Promise<CarrierReading>

const credentials = (
  container: Pick<MedusaContainer, "resolve">,
  provider: CredentialProviderName
) =>
  container
    .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    .read(provider)

const readGeliver: Reader = async (container, providerShipmentId) => {
  const account = geliverCredentialsOf(await credentials(container, "geliver"))
  if (!account) {
    throw new ValidationError("shipping.carrier_not_connected")
  }
  const shipment = await geliverApi().shipment(account, providerShipmentId)
  return {
    ...geliverStatusOf(shipment),
    tracking_number: shipment.trackingNumber ?? null,
    tracking_url: shipment.trackingUrl ?? null,
  }
}

const readAras: Reader = async (container, providerShipmentId) => {
  const account = arasCredentialsOf(await credentials(container, "aras"))
  if (!account) {
    throw new ValidationError("shipping.carrier_not_connected")
  }
  return arasStatusOf(await arasApi().cargoInfo(account, providerShipmentId))
}

/**
 * How each carrier is asked about a parcel (adr/0035): the shop's account
 * read at the call, the answer mapped to our statuses. A carrier without
 * a reader yet is not tracked.
 */
const READERS: Partial<Record<CarrierName, Reader>> = {
  geliver: readGeliver,
  aras: readAras,
}

export function carrierReader(provider: string): Reader {
  const reader = READERS[provider as CarrierName]
  if (!reader) {
    throw new ValidationError("shipping.carrier_unknown")
  }
  return reader
}
