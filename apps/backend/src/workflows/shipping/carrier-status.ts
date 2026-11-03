import type { MedusaContainer } from "@medusajs/framework/types"
import { parseEnv } from "../../lib/env"
import { ValidationError } from "../../lib/errors"
import type { CarrierName } from "../../lib/shipping/carriers"
import { arasApi, arasCredentialsOf, arasStatusOf } from "../../lib/shipping/aras"
import { geliverApi, geliverCredentialsOf, geliverStatusOf } from "../../lib/shipping/geliver"
import { yurticiApi, yurticiCredentialsOf, yurticiStatusOf } from "../../lib/shipping/yurtici"
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
  return arasStatusOf(
    await arasApi().cargoInfo(account, providerShipmentId),
    parseEnv().ARAS_BASE_URL
  )
}

const readYurtici: Reader = async (container, providerShipmentId) => {
  const account = yurticiCredentialsOf(await credentials(container, "yurtici"))
  if (!account) {
    throw new ValidationError("shipping.carrier_not_connected")
  }
  const api = yurticiApi()
  const delivery = await api.query(account.main, account.testMode, providerShipmentId)
  // A parcel paid at the door went out on the door account: only that one knows it
  return yurticiStatusOf(
    !delivery.found && account.cod
      ? await api.query(account.cod, account.testMode, providerShipmentId)
      : delivery,
    parseEnv().YURTICI_BASE_URL
  )
}

/**
 * How each carrier is asked about a parcel (adr/0035): the shop's account
 * read at the call, the answer mapped to our statuses. With a fake Aras or
 * Yurtiçi set, the parcel's link opens the fake's own page; Geliver's link
 * is the one its answer gives.
 */
const READERS: Record<CarrierName, Reader> = {
  geliver: readGeliver,
  aras: readAras,
  yurtici: readYurtici,
}

export function carrierReader(provider: string): Reader {
  // Own keys only: the provider comes from a stored row
  if (!Object.hasOwn(READERS, provider)) {
    throw new ValidationError("shipping.carrier_unknown")
  }
  return READERS[provider as CarrierName]
}
