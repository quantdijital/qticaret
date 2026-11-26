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
import { pttApi, pttCredentialsOf, pttDesi, pttFileName } from "../../lib/shipping/ptt"
import type { PttCredentials, PttShipmentInput } from "../../lib/shipping/ptt"
import { shipmentReceiverOf } from "../../lib/shipping/receiver"
import {
  flatQuoteOf,
  packedParcelOf,
  shipmentCode,
  shippingRates,
  storedCarrierAccount,
  tableQuoteOf,
} from "../../lib/shipping/shop"
import { cancelPttParcel, openPttParcel, takeBack } from "./ship"

/**
 * How a PTT option is priced: a flat amount set with the option, or the
 * shop's table by desi. PTT quotes no price on the call.
 */
export const PTT_OPTIONS = [
  { id: "ptt-flat", name: "PTT Kargo: flat price" },
  { id: "ptt-table", name: "PTT Kargo: the shop's price table" },
] as const

const isPttOption = (id: unknown): boolean => PTT_OPTIONS.some((option) => option.id === id)

const storedPttAccount = (): Promise<PttCredentials> =>
  storedCarrierAccount("ptt", pttCredentialsOf)

/**
 * PTT Kargo as a Medusa fulfillment provider (`ptt_ptt`;
 * docs/entegrasyonlar/ptt.md), on the shop's own contract. On our "ship"
 * route it loads the parcel under the barcode our workflow took from the
 * shop's range (`qt_ship.barcode`), then draws our label with that
 * barcode (PTT gives no PDF label). The account and the shop's units come
 * from the shared container at the time of the call; the barcode and what
 * the courier collects come from our workflow (`additional_data`), so
 * Medusa's own fulfillment route cannot open one.
 */
class PttFulfillmentService extends AbstractFulfillmentProviderService {
  static override identifier = "ptt"

  override getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return Promise.resolve(PTT_OPTIONS.map((option) => ({ ...option })))
  }

  override validateOption(data: Record<string, unknown>): Promise<boolean> {
    return Promise.resolve(isPttOption(data["id"]))
  }

  override validateFulfillmentData(
    optionData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!isPttOption(optionData["id"])) {
      return Promise.reject(new ValidationError("shipping.option_invalid"))
    }
    return Promise.resolve({ option: optionData["id"] })
  }

  override canCalculate(data: CreateShippingOptionDTO): Promise<boolean> {
    return Promise.resolve(isPttOption(data.data?.["id"]))
  }

  /** The option's flat amount, or the cart's parcel priced by the shop's table (adr/0087). */
  override async calculatePrice(
    optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    context: CalculateShippingOptionPriceContext
  ): Promise<CalculatedShippingOptionPrice> {
    return optionData["id"] === "ptt-flat"
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
    if (!ship?.barcode) {
      throw new ValidationError("shipping.use_ship_route")
    }
    const credentials = await storedPttAccount()
    const parcel = await packedParcelOf(items, order?.items)
    // The delivery address our workflow filled (adr/0054 addendum), else the order's own
    const receiver = shipmentReceiverOf(ship.receiver ?? order?.shipping_address)
    const number = String(order?.display_id ?? order?.id ?? "")
    const displayId = order?.display_id ?? null
    const input: PttShipmentInput = {
      barcode: ship.barcode,
      reference: shipmentCode(),
      receiver,
      // A parcel the default filled in goes without measures: the branch measures it (adr/0054)
      parcel: parcel.measured ? parcel : null,
      cashOnDelivery: ship.cash_on_delivery,
    }
    const fileName = pttFileName(input.reference)
    const api = pttApi()
    await openPttParcel(api, credentials, input, fileName, displayId)
    let label: string
    try {
      label = Buffer.from(
        await carrierLabelPdf(
          {
            carrier: "PTT Kargo",
            code: input.barcode,
            // PTT knows the sender from the contract (its customer number)
            sender: null,
            orderNumber: number,
            receiver,
            desi: input.parcel ? pttDesi(input.parcel) : null,
            kg: input.parcel ? input.parcel.weight_kg : null,
            cashOnDelivery: input.cashOnDelivery,
            test: credentials.testMode,
          },
          labelSizeOf(await shippingRates())
        )
      ).toString("base64")
    } catch (error) {
      // No label, no parcel: PTT's record is deleted so nothing waits at a branch
      await takeBack(api, credentials, input.barcode, fileName, displayId)
      throw error
    }
    logger.info({
      event: "ptt.shipment_opened",
      pttBarcode: input.barcode,
      orderDisplayId: displayId,
      test: credentials.testMode,
    })
    return {
      data: {
        shipment_id: input.barcode,
        reference: input.reference,
        // Asked again to delete it (`barkodVeriSil`)
        file_name: fileName,
        test: credentials.testMode,
        cash_on_delivery: ship.cash_on_delivery,
        label_base64: label,
        label_type: "application/pdf",
      },
      labels: [],
    }
  }

  /**
   * Deletes the parcel at PTT before a branch accepts it; after that PTT
   * refuses and the fulfillment stays (`ptt.already_accepted`).
   */
  override async cancelFulfillment(
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const barcode = data["shipment_id"]
    const fileName = data["file_name"]
    if (typeof barcode === "string") {
      await cancelPttParcel(
        pttApi(),
        await storedPttAccount(),
        barcode,
        typeof fileName === "string" ? fileName : null
      )
    }
    return {}
  }
}

export default PttFulfillmentService
