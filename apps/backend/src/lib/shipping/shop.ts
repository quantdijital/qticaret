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
import { defaultParcelOf, parcelOf } from "./parcel"
import type { ParcelLine, ParcelUnits } from "./parcel"
import { kurus, toMedusaAmount } from "../money"
import type { Kurus } from "../money"
import { tablePrice } from "./rates"
import { quoteContextOf, shippingQuote } from "./quote"
import type { QuoteLine } from "./quote"

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
 * The parcel the lines make; a line without measures (or with one that
 * cannot be a measure) takes the shop's default parcel (adr/0054). Never
 * refused: the carrier measures the real parcel.
 */
export async function parcelFor(lines: ParcelLine[]) {
  const [units, shipping] = await Promise.all([storeUnits(), shippingRates()])
  return parcelOf(lines, units, defaultParcelOf(shipping.default_parcel, units))
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

/** A quote in kuruş as Medusa takes a calculated price: lira, KDV in. */
export const calculatedPriceOf = (amount: Kurus) => ({
  calculated_amount: Number(toMedusaAmount(amount)),
  is_calculated_price_tax_inclusive: true,
})

/** A cart line as the quote and the parcel read it. */
export type CartLine = OrderItemRow & QuoteLine

/** A provider context's lines, the missing ones left out. */
export const cartLinesOf = (context: { items?: readonly (CartLine | null)[] | null }): CartLine[] =>
  (context.items ?? []).filter((item): item is CartLine => item !== null)

/**
 * A cart's price by the shop's desi table (adr/0035), through the one
 * shipping quote (adr/0087 §2): the paid lines' parcel, free past the
 * basket threshold or with every product free, plus a class surcharge.
 */
export async function tableQuoteOf(context: { items?: readonly (CartLine | null)[] | null }) {
  const amount = await shippingQuote({
    lines: cartLinesOf(context),
    context: quoteContextOf(context),
    basis: "parcel",
    price: async (lines) => tablePriceOf((await parcelFor(parcelLinesOf(lines))).desi),
  })
  return calculatedPriceOf(amount)
}

/**
 * A flat-priced option's amount (adr/0087 §2): kept in its `data.amount`,
 * kuruş, KDV in, written by our workflows only. Anything else is refused:
 * an option without a price is never free by mistake.
 */
export function flatAmountOf(optionData: Record<string, unknown> | null | undefined): Kurus {
  const amount = optionData?.["amount"]
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 0) {
    throw new ValidationError("shipping.option_invalid")
  }
  return kurus(amount)
}

/** A flat-priced option for a cart: its amount, through the one quote (free past the threshold). */
export async function flatQuoteOf(
  optionData: Record<string, unknown>,
  context: { items?: readonly (CartLine | null)[] | null }
) {
  const amount = flatAmountOf(optionData)
  return calculatedPriceOf(
    await shippingQuote({
      lines: cartLinesOf(context),
      context: quoteContextOf(context),
      // Per order: a mixed basket pays it in full (adr/0087, the owner's answer 2)
      basis: "order",
      price: () => amount,
    })
  )
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
