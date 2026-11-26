import type { MedusaContainer } from "@medusajs/framework/types"
import { parseEnv } from "../../lib/env"
import { ValidationError } from "../../lib/errors"
import type { CarrierName } from "../../lib/shipping/carriers"
import { arasApi, arasCredentialsOf, arasStatusOf } from "../../lib/shipping/aras"
import { yurticiApi, yurticiCredentialsOf, yurticiStatusOf } from "../../lib/shipping/yurtici"
import { dhlEcomApi, dhlEcomCredentialsOf, dhlEcomStatusOf } from "../../lib/shipping/dhlecommerce"
import { suratApi, suratCredentialsOf, suratStatusOf } from "../../lib/shipping/surat"
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

// By our reference: DHL lists the order under it from the start, its shipment number after
const readDhlEcom: Reader = async (container, providerShipmentId) => {
  const account = dhlEcomCredentialsOf(await credentials(container, "dhlecommerce"))
  if (!account) {
    throw new ValidationError("shipping.carrier_not_connected")
  }
  return dhlEcomStatusOf(
    await dhlEcomApi().status(account, providerShipmentId),
    parseEnv().DHL_ECOMMERCE_BASE_URL
  )
}

// By our code (`WebSiparisKodu`): Sürat lists nothing until the branch has the parcel
const readSurat: Reader = async (container, providerShipmentId) => {
  const account = suratCredentialsOf(await credentials(container, "surat"))
  if (!account) {
    throw new ValidationError("shipping.carrier_not_connected")
  }
  return suratStatusOf(
    await suratApi().track(account, providerShipmentId),
    parseEnv().SURAT_BASE_URL
  )
}

/**
 * How each carrier is asked about a parcel (adr/0035): the shop's account
 * read at the call, the answer mapped to our statuses. With a fake Aras or
 * Yurtiçi set, the parcel's link opens the fake's own page.
 */
const READERS: Record<CarrierName, Reader> = {
  aras: readAras,
  yurtici: readYurtici,
  dhlecommerce: readDhlEcom,
  surat: readSurat,
}

export function carrierReader(provider: string): Reader {
  // Own keys only: the provider comes from a stored row
  if (!Object.hasOwn(READERS, provider)) {
    throw new ValidationError("shipping.carrier_unknown")
  }
  return READERS[provider as CarrierName]
}
