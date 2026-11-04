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
import { errorSummary, logger } from "../../lib/logging"
import { toMedusaAmount } from "../../lib/money"
import { arasApi, arasCredentialsOf } from "../../lib/shipping/aras"
import type { ArasCredentials } from "../../lib/shipping/aras"
import { shipInputOf } from "../../lib/shipping/carriers"
import { parcelLinesOf } from "../../lib/shipping/geliver/mappers"
import { shipmentReceiverOf } from "../../lib/shipping/receiver"
import {
  packedParcelOf,
  parcelFor,
  shipmentCode,
  storedCarrierAccount,
  tablePriceOf,
} from "../../lib/shipping/shop"

/**
 * How an Aras option is priced (adr/0035): a flat amount set with the
 * option, or the shop's table by desi. Aras quotes no price on the call.
 */
export const ARAS_OPTIONS = [
  { id: "aras-flat", name: "Aras Kargo: flat price" },
  { id: "aras-table", name: "Aras Kargo: the shop's price table" },
] as const

const isArasOption = (id: unknown): boolean => ARAS_OPTIONS.some((option) => option.id === id)

const storedArasAccount = (): Promise<ArasCredentials> =>
  storedCarrierAccount("aras", arasCredentialsOf)

/**
 * Aras Kargo as a Medusa fulfillment provider (`aras_aras`, adr/0035), on
 * the shop's own contract. On our "ship" route it hands the parcel's order
 * to Aras under our code and takes its label; the order is withdrawn when
 * the label cannot be had or Aras's answer never came. The account and
 * the shop's units come from the shared container at the time of the
 * call; what the courier collects comes from our workflow
 * (`additional_data`), so Medusa's own fulfillment route cannot open one.
 */
class ArasFulfillmentService extends AbstractFulfillmentProviderService {
  static override identifier = "aras"

  override getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return Promise.resolve(ARAS_OPTIONS.map((option) => ({ ...option })))
  }

  override validateOption(data: Record<string, unknown>): Promise<boolean> {
    return Promise.resolve(isArasOption(data["id"]))
  }

  override validateFulfillmentData(
    optionData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!isArasOption(optionData["id"])) {
      return Promise.reject(new ValidationError("shipping.option_invalid"))
    }
    return Promise.resolve({ option: optionData["id"] })
  }

  override canCalculate(data: CreateShippingOptionDTO): Promise<boolean> {
    return Promise.resolve(data.data?.["id"] === "aras-table")
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
    const credentials = await storedArasAccount()
    const parcel = await packedParcelOf(items, order?.items)
    // The delivery address our workflow filled (adr/0054 addendum), else the order's own
    const receiver = shipmentReceiverOf(ship.receiver ?? order?.shipping_address)
    const api = arasApi()
    const code = shipmentCode()
    const number = String(order?.display_id ?? order?.id ?? "")
    try {
      await api.setOrder(credentials, {
        integrationCode: code,
        waybill: number,
        receiver,
        // A product without measures counts as the shop's default parcel (adr/0054)
        desi: parcel.desi,
        kg: parcel.weight_kg,
        cashOnDelivery: ship.cash_on_delivery,
        description: `Sipariş ${number}`,
      })
      const pdf = await api.label(credentials, code)
      return {
        data: {
          shipment_id: code,
          test: credentials.testMode,
          cash_on_delivery: ship.cash_on_delivery,
          ...(pdf ? { label_base64: pdf, label_type: "application/pdf" } : {}),
        },
        labels: [],
      }
    } catch (error) {
      // No label, or an answer that never came: withdrawn at Aras, nothing is left behind
      await api.cancel(credentials, code).catch((cancel: unknown) => {
        logger.warn({
          event: "aras.order_withdraw_failed",
          arasIntegrationCode: code,
          orderDisplayId: order?.display_id ?? null,
          err: errorSummary(cancel),
        })
      })
      throw error
    }
  }

  /** Withdraws the order at Aras; Medusa refuses a fulfillment already shipped. */
  override async cancelFulfillment(
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const code = data["shipment_id"]
    if (typeof code === "string") {
      await arasApi().cancel(await storedArasAccount(), code)
    }
    return {}
  }
}

export default ArasFulfillmentService
