import { container } from "@medusajs/framework"
import { ValidationError } from "../../lib/errors"
import type { ParcelUnits } from "../../lib/shipping/parcel"
import { geliverCredentialsOf } from "../../lib/shipping/geliver"
import type { GeliverCredentials } from "../../lib/shipping/geliver"
import { INTEGRATION_CREDENTIALS_MODULE } from "../integration-credentials"
import type IntegrationCredentialsModuleService from "../integration-credentials/service"
import { PLATFORM_SETTINGS_MODULE } from "../platform-settings"
import type PlatformSettingsModuleService from "../platform-settings/service"
import type { ShippingSettings, StoreSettings } from "../platform-settings/sections"

/**
 * The shop's Geliver account at the time of the call (adr/0027, adr/0031),
 * from the app's shared container like the payment providers' accounts.
 * Refused when nothing is stored: no shipment without the shop's account.
 */
export async function storedGeliverAccount(): Promise<GeliverCredentials> {
  const credentials = container.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  const account = geliverCredentialsOf(await credentials.read("geliver"))
  if (!account) {
    throw new ValidationError("shipping.carrier_not_connected")
  }
  return account
}

const settings = () => container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

/** The units the shop keeps product weights and measures in (Settings > Store), read per call. */
export async function storeUnits(): Promise<ParcelUnits> {
  const store = (await settings().getSection("store")) as unknown as StoreSettings
  return { weight_unit: store.weight_unit, dimension_unit: store.dimension_unit }
}

/** The shop's price table by desi (Settings > Shipping, F7.8), read per call. */
export const shippingRates = async (): Promise<ShippingSettings> =>
  (await settings().getSection("shipping")) as unknown as ShippingSettings
