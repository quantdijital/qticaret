import { container } from "@medusajs/framework"
import { randomBytes } from "node:crypto"
import { ValidationError } from "../errors"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type { CredentialProviderName } from "../../modules/integration-credentials/providers"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import type { AccountDetails } from "../integrations/account-check"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import type { ShippingSettings, StoreSettings } from "../../modules/platform-settings/sections"
import { parcelLinesOf } from "./geliver/mappers"
import type { OrderItemRow } from "./geliver/mappers"
import { InvalidMeasures, defaultParcelOf, parcelOf } from "./parcel"
import type { ParcelLine, ParcelUnits } from "./parcel"
import type { Kurus } from "../money"
import { tablePrice } from "./rates"

/**
 * What a carrier provider reads of the shop at the time of the call, from
 * the app's shared container (adr/0027, adr/0031, adr/0035; the narrow
 * exception in apps/backend/CLAUDE.md): its account, its units, its
 * price table by desi and its default parcel (adr/0054).
 */

/** The shop's account with a carrier; refused when none is stored. */
export async function storedCarrierAccount<T>(
  provider: CredentialProviderName,
  read: (account: AccountDetails | null) => T | null
): Promise<T> {
  const credentials = container.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  const account = read(await credentials.read(provider))
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

/**
 * The parcel the lines make; a line without measures takes the shop's
 * default parcel (adr/0054). Refused only for a value that cannot be a
 * measure (below zero).
 */
export async function parcelFor(lines: ParcelLine[]) {
  const [units, shipping] = await Promise.all([storeUnits(), shippingRates()])
  try {
    return parcelOf(lines, units, defaultParcelOf(shipping.default_parcel, units))
  } catch (error) {
    if (error instanceof InvalidMeasures) {
      throw new ValidationError("shipping.measures_invalid", { field: "items" })
    }
    throw error
  }
}

/** The parcel a fulfillment packs: the order's lines at the quantities packed. */
export function packedParcelOf(
  packedItems: readonly { line_item_id?: string | null; quantity?: number | null }[],
  orderItems: readonly OrderItemRow[] | null | undefined
) {
  const packed = new Map(packedItems.map((item) => [item.line_item_id, item.quantity ?? 0]))
  return parcelFor(
    parcelLinesOf((orderItems ?? []).map((row) => ({ ...row, quantity: packed.get(row.id) ?? 0 })))
  )
}

/** The parcel priced by the shop's table, tax included; refused past its last band without a rate. */
export async function tablePriceOf(desi: number): Promise<Kurus> {
  const rates = await shippingRates()
  const price = tablePrice(rates.rate_table, rates.over_desi_price, desi)
  if (price === null) {
    throw new ValidationError("shipping.no_rate")
  }
  return price
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/**
 * Our code for a parcel at a contract carrier (adr/0035): `QT` and 14
 * characters (70 random bits), within the 20 a carrier takes, unambiguous
 * on a printed barcode.
 */
export function shipmentCode(): string {
  const bytes = randomBytes(14)
  return `QT${[...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("")}`
}
