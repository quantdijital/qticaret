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
import { shipInputOf } from "../../lib/shipping/carriers"
import { dhlEcomApi, dhlEcomCredentialsOf, wholeUp } from "../../lib/shipping/dhlecommerce"
import type { DhlEcomCredentials, DhlEcomShipmentInput } from "../../lib/shipping/dhlecommerce"
import { carrierLabelPdf } from "../../lib/shipping/label"
import { labelSizeOf } from "../../lib/shipping/label-sheet"
import { shipmentReceiverOf } from "../../lib/shipping/receiver"
import {
  flatQuoteOf,
  packedParcelOf,
  shipmentCode,
  shippingRates,
  shopSender,
  storedCarrierAccount,
  tableQuoteOf,
} from "../../lib/shipping/shop"
import { openDhlEcomParcel, withdrawDhlEcomParcel } from "./ship"

/**
 * How a DHL eCommerce option is priced: a flat amount set with the
 * option, or the shop's table by desi. DHL quotes no price on the call.
 */
export const DHL_ECOMMERCE_OPTIONS = [
  { id: "dhlecommerce-flat", name: "DHL eCommerce: flat price" },
  { id: "dhlecommerce-table", name: "DHL eCommerce: the shop's price table" },
] as const

const isDhlEcomOption = (id: unknown): boolean =>
  DHL_ECOMMERCE_OPTIONS.some((option) => option.id === id)

const storedDhlEcomAccount = (): Promise<DhlEcomCredentials> =>
  storedCarrierAccount("dhlecommerce", dhlEcomCredentialsOf)

/** The parcel's volume in desi, its weight apart: whole numbers of at least one, as DHL's pieces take. */
const piecesOf = (parcel: {
  length_cm: number
  width_cm: number
  height_cm: number
  weight_kg: number
}) => ({
  desi: wholeUp((parcel.length_cm * parcel.width_cm * parcel.height_cm) / 3000),
  kg: wholeUp(parcel.weight_kg),
})

/**
 * DHL eCommerce Türkiye (formerly MNG Kargo) as a Medusa fulfillment
 * provider (`dhlecommerce_dhlecommerce`; docs/entegrasyonlar/
 * dhlecommerce.md), on the shop's own contract with the platform's app
 * keys. On our "ship" route it opens the parcel in DHL's three steps
 * (`./ship`) and draws our own PDF label from DHL's barcode (DHL gives a
 * Zebra label a browser cannot show; it is kept beside ours). The account,
 * the shop's units and its sender details come from the shared container
 * at the time of the call; what the courier collects and the order's
 * e-mail come from our workflow (`additional_data`), so Medusa's own
 * fulfillment route cannot open one.
 */
class DhlEcomFulfillmentService extends AbstractFulfillmentProviderService {
  static override identifier = "dhlecommerce"

  override getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return Promise.resolve(DHL_ECOMMERCE_OPTIONS.map((option) => ({ ...option })))
  }

  override validateOption(data: Record<string, unknown>): Promise<boolean> {
    return Promise.resolve(isDhlEcomOption(data["id"]))
  }

  override validateFulfillmentData(
    optionData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!isDhlEcomOption(optionData["id"])) {
      return Promise.reject(new ValidationError("shipping.option_invalid"))
    }
    return Promise.resolve({ option: optionData["id"] })
  }

  override canCalculate(data: CreateShippingOptionDTO): Promise<boolean> {
    return Promise.resolve(isDhlEcomOption(data.data?.["id"]))
  }

  /** The option's flat amount, or the cart's parcel priced by the shop's table (adr/0087). */
  override async calculatePrice(
    optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    context: CalculateShippingOptionPriceContext
  ): Promise<CalculatedShippingOptionPrice> {
    return optionData["id"] === "dhlecommerce-flat"
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
    const credentials = await storedDhlEcomAccount()
    // DHL refuses a receiver without an e-mail; the order's own, from our workflow
    if (!ship.email) {
      throw new ValidationError("dhlecommerce.email_missing")
    }
    const parcel = await packedParcelOf(items, order?.items)
    // Il and ilçe are DHL's codes: both required
    const receiver = shipmentReceiverOf(ship.receiver ?? order?.shipping_address)
    const api = dhlEcomApi()
    const places = await api.placeCodes(credentials.testMode, receiver.city, receiver.town)
    const number = String(order?.display_id ?? order?.id ?? "")
    const input: DhlEcomShipmentInput = {
      referenceId: shipmentCode(),
      orderNumber: number,
      receiver,
      email: ship.email,
      ...places,
      ...piecesOf(parcel),
      cashOnDelivery: ship.cash_on_delivery,
    }
    const made = await openDhlEcomParcel(api, credentials, input, order?.display_id ?? null)
    const [first] = made.pieces
    let label: Uint8Array
    try {
      label = await carrierLabelPdf(
        {
          carrier: "DHL eCommerce",
          code: first?.barcode ?? input.referenceId,
          shipmentNumber: made.shipmentId,
          sender: await shopSender(),
          orderNumber: number,
          receiver,
          desi: input.desi,
          kg: input.kg,
          cashOnDelivery: input.cashOnDelivery,
          test: credentials.testMode,
        },
        labelSizeOf(await shippingRates())
      )
    } catch (error) {
      // No label, no parcel: DHL's is taken back so nothing waits for a courier
      await withdrawDhlEcomParcel(api, credentials, input.referenceId, made.shipmentId).catch(
        () => undefined
      )
      throw error
    }
    return {
      data: {
        shipment_id: input.referenceId,
        dhl_shipment_id: made.shipmentId,
        test: credentials.testMode,
        cash_on_delivery: ship.cash_on_delivery,
        label_base64: Buffer.from(label).toString("base64"),
        label_type: "application/pdf",
        // DHL's own Zebra label: stored privately beside ours, for a thermal printer later
        label_zpl: first?.zpl ?? null,
      },
      labels: [],
    }
  }

  /**
   * Withdraws the parcel at DHL: its barcode, then its order. Refused once
   * the branch has taken it, or after the day it was made: the
   * fulfillment then stays and tracking follows the parcel.
   */
  override async cancelFulfillment(
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const referenceId = data["shipment_id"]
    if (typeof referenceId === "string") {
      const credentials = await storedDhlEcomAccount()
      const shipmentId = data["dhl_shipment_id"]
      await withdrawDhlEcomParcel(
        dhlEcomApi(),
        { ...credentials, testMode: data["test"] === true },
        referenceId,
        typeof shipmentId === "string" ? shipmentId : null
      )
    }
    return {}
  }
}

export default DhlEcomFulfillmentService
