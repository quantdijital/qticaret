import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceContext,
  CreateFulfillmentResult,
  CreateShippingOptionDTO,
  FulfillmentOption,
} from "@medusajs/framework/types"
import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { SHOP_FLAT_OPTION } from "../../lib/shipping/carriers"
import { flatQuoteOf } from "../../lib/shipping/shop"

const isShopOption = (id: unknown): boolean => id === SHOP_FLAT_OPTION

/**
 * The shop's own delivery ("Kendi gönderimim") at a flat price, as our
 * provider (`shop_shop`, adr/0087 §2): Medusa's flat price cannot know a
 * basket of free-shipping products, so the panel's "Sabit ücret" is a
 * calculated price here, the amount kept in the option's `data.amount`
 * (kuruş, KDV in) and priced through the one shipping quote. Like
 * Medusa's manual provider it opens nothing anywhere: the shop carries
 * the parcel itself. What a shopper sends with the method is not kept.
 */
class ShopFulfillmentService extends AbstractFulfillmentProviderService {
  static override identifier = "shop"

  override getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return Promise.resolve([{ id: SHOP_FLAT_OPTION, name: "The shop's own delivery: flat price" }])
  }

  override validateOption(data: Record<string, unknown>): Promise<boolean> {
    return Promise.resolve(isShopOption(data["id"]))
  }

  override validateFulfillmentData(
    optionData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!isShopOption(optionData["id"])) {
      return Promise.reject(new ValidationError("shipping.option_invalid"))
    }
    return Promise.resolve({ option: SHOP_FLAT_OPTION })
  }

  override canCalculate(data: CreateShippingOptionDTO): Promise<boolean> {
    return Promise.resolve(isShopOption(data.data?.["id"]))
  }

  /** The option's flat amount, KDV in; free past the threshold (adr/0087 §2). */
  override calculatePrice(
    optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    context: CalculateShippingOptionPriceContext
  ): Promise<CalculatedShippingOptionPrice> {
    return flatQuoteOf(optionData, context)
  }

  override createFulfillment(): Promise<CreateFulfillmentResult> {
    // The shop carries the parcel: nothing is sent anywhere
    return Promise.resolve({ data: {}, labels: [] })
  }

  override cancelFulfillment(): Promise<Record<string, unknown>> {
    return Promise.resolve({})
  }

  override createReturnFulfillment(): Promise<CreateFulfillmentResult> {
    return Promise.resolve({ data: {}, labels: [] })
  }
}

export default ShopFulfillmentService
