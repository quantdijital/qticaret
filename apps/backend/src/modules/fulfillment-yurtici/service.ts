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
import { ValidationError, isProviderError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { toMedusaAmount } from "../../lib/money"
import { shipInputOf } from "../../lib/shipping/carriers"
import { parcelLinesOf } from "../../lib/shipping/geliver/mappers"
import { labelSizeOf } from "../../lib/shipping/label-sheet"
import { shipmentReceiverOf } from "../../lib/shipping/receiver"
import {
  packedParcelOf,
  parcelFor,
  shipmentCode,
  shippingRates,
  storedCarrierAccount,
  tablePriceOf,
} from "../../lib/shipping/shop"
import {
  yurticiApi,
  yurticiCredentialsOf,
  yurticiDesi,
  yurticiLabelPdf,
  yurticiReceiverGap,
} from "../../lib/shipping/yurtici"
import type { YurticiCredentials, YurticiLogin } from "../../lib/shipping/yurtici"

/**
 * How a Yurtiçi option is priced (adr/0035): a flat amount set with the
 * option, or the shop's table by desi. Yurtiçi quotes no price on the call.
 */
export const YURTICI_OPTIONS = [
  { id: "yurtici-flat", name: "Yurtiçi Kargo: flat price" },
  { id: "yurtici-table", name: "Yurtiçi Kargo: the shop's price table" },
] as const

const isYurticiOption = (id: unknown): boolean => YURTICI_OPTIONS.some((option) => option.id === id)

const storedYurticiAccount = (): Promise<YurticiCredentials> =>
  storedCarrierAccount("yurtici", yurticiCredentialsOf)

/**
 * Yurtiçi answered and said no (an answer's code, or a fault, also one sent
 * as HTTP 500): nothing was opened, nothing to withdraw.
 */
const refusedOutright = (error: unknown): boolean =>
  isProviderError(error) &&
  (error.providerCode === "rejected" || error.providerCode.startsWith("error_"))

/** The login a parcel goes out on: Yurtiçi's door account when the courier collects. */
function loginFor(credentials: YurticiCredentials, cashOnDelivery: unknown): YurticiLogin {
  if (cashOnDelivery === null || cashOnDelivery === undefined) {
    return credentials.main
  }
  if (!credentials.cod) {
    throw new ValidationError("yurtici.cod_account_missing")
  }
  return credentials.cod
}

/**
 * Yurtiçi Kargo as a Medusa fulfillment provider (`yurtici_yurtici`,
 * adr/0035), on the shop's own contract. On our "ship" route it opens the
 * parcel under our cargo key and draws its PDF label (Yurtiçi gives none: the
 * branch scans the key). The account and the shop's units come from the
 * shared container at the time of the call; what the courier collects
 * comes from our workflow (`additional_data`), so Medusa's own
 * fulfillment route cannot open one.
 */
class YurticiFulfillmentService extends AbstractFulfillmentProviderService {
  static override identifier = "yurtici"

  override getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return Promise.resolve(YURTICI_OPTIONS.map((option) => ({ ...option })))
  }

  override validateOption(data: Record<string, unknown>): Promise<boolean> {
    return Promise.resolve(isYurticiOption(data["id"]))
  }

  override validateFulfillmentData(
    optionData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!isYurticiOption(optionData["id"])) {
      return Promise.reject(new ValidationError("shipping.option_invalid"))
    }
    return Promise.resolve({ option: optionData["id"] })
  }

  override canCalculate(data: CreateShippingOptionDTO): Promise<boolean> {
    return Promise.resolve(data.data?.["id"] === "yurtici-table")
  }

  /** The cart's parcel priced by the shop's table, tax included. */
  override async calculatePrice(
    _optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    context: CalculateShippingOptionPriceContext
  ): Promise<CalculatedShippingOptionPrice> {
    const parcel = await parcelFor(parcelLinesOf(context.items))
    return {
      calculated_amount: Number(toMedusaAmount(await tablePriceOf(parcel.desi))),
      is_calculated_price_tax_inclusive: true,
    }
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
    const credentials = await storedYurticiAccount()
    const login = loginFor(credentials, ship.cash_on_delivery)
    const parcel = await packedParcelOf(items, order?.items)
    const receiver = shipmentReceiverOf(order?.shipping_address)
    // What Yurtiçi's document refuses (a name under 5 characters, an address under 10), told here
    const gap = yurticiReceiverGap(receiver)
    if (gap) {
      throw new ValidationError("shipping.address_incomplete", { field: `shipping_address.${gap}` })
    }
    const cargoKey = shipmentCode()
    const number = String(order?.display_id ?? order?.id ?? "")
    const shipment = {
      cargoKey,
      orderNumber: number,
      receiver,
      // Yurtiçi keeps the volume's desi and the weight apart, and charges the larger
      desi: yurticiDesi(parcel),
      kg: parcel.weight_kg,
      cashOnDelivery: ship.cash_on_delivery,
    }
    const api = yurticiApi()
    try {
      await api.createShipment(login, credentials.testMode, shipment)
    } catch (error) {
      if (refusedOutright(error)) {
        throw error
      }
      // An answer that never came may have opened it: withdrawn, so nothing is left behind
      await api.cancel(login, credentials.testMode, cargoKey).catch((cancel: unknown) => {
        logger.warn({
          event: "yurtici.shipment_withdraw_failed",
          yurticiCargoKey: cargoKey,
          orderDisplayId: order?.display_id ?? null,
          err: errorSummary(cancel),
        })
      })
      throw error
    }
    const label = await yurticiLabelPdf(
      { ...shipment, test: credentials.testMode },
      labelSizeOf(await shippingRates())
    )
    return {
      data: {
        shipment_id: cargoKey,
        test: credentials.testMode,
        cash_on_delivery: ship.cash_on_delivery,
        label_base64: Buffer.from(label).toString("base64"),
        label_type: "application/pdf",
      },
      labels: [],
    }
  }

  /**
   * Withdraws the parcel at Yurtiçi, on the login it went out on. Refused
   * once its document is issued: Yurtiçi then takes the call as a return
   * request (`return_requested`), so the fulfillment stays and tracking
   * follows the parcel back.
   */
  override async cancelFulfillment(
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const cargoKey = data["shipment_id"]
    if (typeof cargoKey === "string") {
      const credentials = await storedYurticiAccount()
      const login = loginFor(credentials, data["cash_on_delivery"])
      await yurticiApi().cancel(login, data["test"] === true, cargoKey)
    }
    return {}
  }
}

export default YurticiFulfillmentService
