import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceContext,
  CreateFulfillmentResult,
  CreateShippingOptionDTO,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentOption,
  FulfillmentOrderDTO,
} from "@medusajs/framework/types"
import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { logger } from "../../lib/logging"
import { shipInputOf } from "../../lib/shipping/carriers"
import { carrierLabelPdf } from "../../lib/shipping/label"
import { labelSizeOf } from "../../lib/shipping/label-sheet"
import { shipmentReceiverOf } from "../../lib/shipping/receiver"
import {
  flatQuoteOf,
  packedParcelOf,
  shipmentCode,
  shippingRates,
  storedCarrierAccount,
  tableQuoteOf,
} from "../../lib/shipping/shop"
import { suratApi, suratCredentialsOf, suratDesi } from "../../lib/shipping/surat"
import type { SuratCredentials, SuratShipmentInput } from "../../lib/shipping/surat"
import { cancelSuratParcel, openSuratParcel, takeBack } from "./ship"

/**
 * How a Sürat option is priced: a flat amount set with the option, or the
 * shop's table by desi. Sürat quotes no price on the call.
 */
export const SURAT_OPTIONS = [
  { id: "surat-flat", name: "Sürat Kargo: flat price" },
  { id: "surat-table", name: "Sürat Kargo: the shop's price table" },
] as const

const isSuratOption = (id: unknown): boolean => SURAT_OPTIONS.some((option) => option.id === id)

const storedSuratAccount = (): Promise<SuratCredentials> =>
  storedCarrierAccount("surat", suratCredentialsOf)

/**
 * Sürat Kargo as a Medusa fulfillment provider (`surat_surat`;
 * docs/entegrasyonlar/surat.md), on the shop's own contract. On our
 * "ship" route it registers the parcel under our code (`./ship`), then
 * takes Sürat's own PDF label when the account may make one, else draws
 * ours with the code as its barcode (Sürat seldom grants labels; that its
 * branches scan our code is to confirm). The account and the shop's units
 * come from the shared container at the time of the call; what the
 * courier collects comes from our workflow (`additional_data`), so
 * Medusa's own fulfillment route cannot open one. Sürat has no test
 * service: no test mode (a developer's machine uses the fake).
 */
class SuratFulfillmentService extends AbstractFulfillmentProviderService {
  static override identifier = "surat"

  override getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return Promise.resolve(SURAT_OPTIONS.map((option) => ({ ...option })))
  }

  override validateOption(data: Record<string, unknown>): Promise<boolean> {
    return Promise.resolve(isSuratOption(data["id"]))
  }

  override validateFulfillmentData(
    optionData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!isSuratOption(optionData["id"])) {
      return Promise.reject(new ValidationError("shipping.option_invalid"))
    }
    return Promise.resolve({ option: optionData["id"] })
  }

  override canCalculate(data: CreateShippingOptionDTO): Promise<boolean> {
    return Promise.resolve(isSuratOption(data.data?.["id"]))
  }

  /** The option's flat amount, or the cart's parcel priced by the shop's table (adr/0087). */
  override async calculatePrice(
    optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    context: CalculateShippingOptionPriceContext
  ): Promise<CalculatedShippingOptionPrice> {
    return optionData["id"] === "surat-flat"
      ? flatQuoteOf(optionData, context)
      : tableQuoteOf(context)
  }

  override async createFulfillment(
    _data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    _fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>,
    additionalData?: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    const ship = shipInputOf(additionalData)
    if (!ship) {
      throw new ValidationError("shipping.use_ship_route")
    }
    const credentials = await storedSuratAccount()
    const parcel = await packedParcelOf(items, order?.items)
    // The delivery address our workflow filled (adr/0054 addendum), else the order's own;
    // il and ilçe are their own fields at Sürat (`Il`, `Ilce`)
    const receiver = shipmentReceiverOf(ship.receiver ?? order?.shipping_address)
    const number = String(order?.display_id ?? order?.id ?? "")
    const displayId = order?.display_id ?? null
    const input: SuratShipmentInput = {
      code: shipmentCode(),
      orderNumber: number,
      receiver,
      // One parcel's desi and kg; a parcel the default filled in goes without them,
      // the branch measures it (adr/0054)
      desi: parcel.measured ? suratDesi(parcel) : null,
      kg: parcel.measured ? parcel.weight_kg : null,
      cashOnDelivery: ship.cash_on_delivery,
    }
    const api = suratApi()
    await openSuratParcel(api, credentials, input, displayId)
    let label: string
    try {
      label =
        (await api.label(credentials, input.code)) ??
        Buffer.from(
          await carrierLabelPdf(
            {
              carrier: "Sürat Kargo",
              code: input.code,
              orderNumber: number,
              receiver,
              desi: input.desi,
              kg: input.kg,
              cashOnDelivery: input.cashOnDelivery,
              test: false,
            },
            labelSizeOf(await shippingRates())
          )
        ).toString("base64")
    } catch (error) {
      // No label, no parcel: Sürat's is deleted so nothing waits for a courier; when Sürat
      // keeps it, staff are told to look there first (`surat.withdraw_failed`)
      await takeBack(api, credentials, input.code, displayId)
      throw error
    }
    logger.info({
      event: "surat.shipment_opened",
      suratCode: input.code,
      orderDisplayId: displayId,
    })
    return {
      data: {
        shipment_id: input.code,
        cash_on_delivery: ship.cash_on_delivery,
        label_base64: label,
        label_type: "application/pdf",
      },
      labels: [],
    }
  }

  /**
   * Cancels the parcel at Sürat: deleted before the branch takes it, asked
   * back after (the fulfillment then stays and tracking follows it home).
   */
  override async cancelFulfillment(
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const code = data["shipment_id"]
    if (typeof code === "string") {
      await cancelSuratParcel(suratApi(), await storedSuratAccount(), code)
    }
    return {}
  }
}

export default SuratFulfillmentService
