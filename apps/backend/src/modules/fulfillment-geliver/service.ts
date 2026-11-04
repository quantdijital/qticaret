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
import { kurus, toMedusaAmount } from "../../lib/money"
import { shipInputOf } from "../../lib/shipping/carriers"
import {
  AddressIncomplete,
  chooseQuote,
  geliverApi,
  geliverRecipientOf,
  parcelLinesOf,
} from "../../lib/shipping/geliver"
import { tablePrice } from "../../lib/shipping/rates"
import { receiverError } from "../../lib/shipping/receiver"
import { packedParcelOf, parcelFor } from "../../lib/shipping/shop"
import { shippingRates, storedGeliverAccount } from "./account"
import { GELIVER_OPTIONS, choiceOf, isGeliverOption } from "./options"
import { pickOffer, shipmentData } from "./shipment"

/**
 * Geliver as a Medusa fulfillment provider (`geliver_geliver`, adr/0031).
 * It prices a parcel from Geliver's price list, and on our "ship" route
 * opens the shipment and buys its label with the offer the option picks.
 * The shop's account and units come from the shared container at the time
 * of the call (adr/0027); the sender address and what the courier
 * collects come from our workflow (`additional_data`), so Medusa's own
 * fulfillment route cannot open one.
 */
class GeliverFulfillmentService extends AbstractFulfillmentProviderService {
  static override identifier = "geliver"

  override getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return Promise.resolve(GELIVER_OPTIONS.map((option) => ({ ...option })))
  }

  override validateOption(data: Record<string, unknown>): Promise<boolean> {
    return Promise.resolve(isGeliverOption(data["id"]))
  }

  /** What the shipping method keeps: the option's choice, from the stored option, never the request. */
  override validateFulfillmentData(
    optionData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!isGeliverOption(optionData["id"])) {
      return Promise.reject(new ValidationError("shipping.option_invalid"))
    }
    const choice = choiceOf(optionData)
    return Promise.resolve({
      option: optionData["id"],
      ...(choice.by === "service" ? { service_code: choice.code } : {}),
    })
  }

  override canCalculate(data: CreateShippingOptionDTO): Promise<boolean> {
    return Promise.resolve(isGeliverOption(data.data?.["id"]))
  }

  /**
   * The cart's parcel priced, tax included: by the shop's table for the
   * table option, else what Geliver quotes for the option's service.
   */
  override async calculatePrice(
    optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    context: CalculateShippingOptionPriceContext
  ): Promise<CalculatedShippingOptionPrice> {
    const parcel = await parcelFor(parcelLinesOf(context.items))
    if (optionData["id"] === "geliver-table") {
      const rates = await shippingRates()
      const price = tablePrice(rates.rate_table, rates.over_desi_price, parcel.desi)
      if (price === null) {
        throw new ValidationError("shipping.no_rate")
      }
      return {
        calculated_amount: Number(toMedusaAmount(price)),
        is_calculated_price_tax_inclusive: true,
      }
    }
    const credentials = await storedGeliverAccount()
    const quote = chooseQuote(await geliverApi().quotes(credentials, parcel), choiceOf(optionData))
    if (!quote) {
      throw new ValidationError("shipping.no_offer")
    }
    return {
      calculated_amount: Number(toMedusaAmount(quote.amount)),
      is_calculated_price_tax_inclusive: true,
    }
  }

  override async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    _fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>,
    additionalData?: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    const ship = shipInputOf(additionalData)
    if (!ship) {
      throw new ValidationError("shipping.use_ship_route")
    }
    const credentials = await storedGeliverAccount()
    const parcel = await packedParcelOf(items, order?.items)
    let recipient
    try {
      // The delivery address our workflow filled (adr/0054 addendum), else the order's own
      recipient = geliverRecipientOf(
        ship.receiver ?? order?.shipping_address,
        order?.email,
        ship.plate
      )
    } catch (error) {
      if (error instanceof AddressIncomplete) {
        throw receiverError(error.field)
      }
      throw error
    }
    const api = geliverApi()
    const created = await api.createShipment(credentials, {
      // The warehouse's sender address our route found for it; none: the account's default sender
      ...(ship.sender_address_id ? { senderAddressID: ship.sender_address_id } : {}),
      recipientAddress: recipient,
      length: parcel.length_cm.toFixed(1),
      width: parcel.width_cm.toFixed(1),
      height: parcel.height_cm.toFixed(1),
      weight: parcel.weight_kg.toFixed(2),
      order: {
        orderNumber: String(order?.display_id ?? order?.id ?? ""),
        totalAmount: toMedusaAmount(kurus(ship.cash_on_delivery ?? 0)),
        totalAmountCurrency: "TRY",
      },
      ...(ship.cash_on_delivery ? { productPaymentOnDelivery: true } : {}),
      ...(credentials.testMode ? { test: true } : {}),
    })
    try {
      const ready = await api.waitForOffers(credentials, created)
      const offer = pickOffer(ready, choiceOf(data))
      if (!offer) {
        throw new ValidationError("shipping.no_offer")
      }
      const accepted = await api.acceptOffer(credentials, offer.id)
      const shipment = accepted.shipment ?? (await api.shipment(credentials, created.id))
      return shipmentData(shipment, offer, ship)
    } catch (error) {
      // No label bought: the shipment is withdrawn at Geliver, nothing is left behind
      await api.cancelShipment(credentials, created.id).catch((cancel: unknown) => {
        // Ids only: support finds the shipment (and a label maybe paid for) at Geliver
        logger.warn({
          event: "geliver.shipment_withdraw_failed",
          geliverShipmentId: created.id,
          orderDisplayId: order?.display_id ?? null,
          err: errorSummary(cancel),
        })
      })
      throw error
    }
  }

  /** Withdraws the shipment at Geliver; Medusa refuses a fulfillment already shipped. */
  override async cancelFulfillment(
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const shipmentId = data["shipment_id"]
    if (typeof shipmentId === "string") {
      await geliverApi().cancelShipment(await storedGeliverAccount(), shipmentId)
    }
    return {}
  }
}

export default GeliverFulfillmentService
